import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { groqChat, groqSTT, groqTTS, getRateLimitStatus } from '../_utils/groq';
import { strictRateLimiter, aiAudioRateLimiter } from '../_middleware/rate-limit';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

ai.use('*', clerkAuthMiddleware);
ai.use('/extract-spin', strictRateLimiter);
ai.use('/spin-suggestions', strictRateLimiter);
ai.use('/insights', strictRateLimiter);
ai.use('/chat', strictRateLimiter);
ai.use('/stt', strictRateLimiter);
ai.use('/tts', aiAudioRateLimiter);

// Helper to fetch compact CRM context for AI (optimized for token limits)
async function getCRMContext(db: D1Database, orgId: string): Promise<string> {
  const orgFilter = `AND owner_id IN (SELECT id FROM users WHERE organization_id = ?)`;

  // Fetch sales reps/team members in this organization
  const salesReps = await db.prepare(`
    SELECT u.id, u.name, u.email, u.role,
      (SELECT COUNT(*) FROM deals WHERE owner_id = u.id AND stage NOT IN ('closed_won', 'closed_lost')) as active_deals,
      (SELECT COALESCE(SUM(value), 0) FROM deals WHERE owner_id = u.id AND stage NOT IN ('closed_won', 'closed_lost')) as pipeline_value,
      (SELECT COUNT(*) FROM deals WHERE owner_id = u.id AND stage = 'closed_won') as won_deals
    FROM users u
    WHERE u.organization_id = ?
    ORDER BY u.name
  `).bind(orgId).all();

  // Fetch deals with key info including owner name
  const deals = await db.prepare(`
    SELECT
      d.id, d.name, d.value, d.stage, d.spin_progress, d.close_date,
      co.name as company_name,
      c.name as contact_name,
      u.name as owner_name
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    ORDER BY d.value DESC
    LIMIT 20
  `).bind(orgId).all();

  // Fetch contacts summary
  const contacts = await db.prepare(`
    SELECT c.id, c.name, c.email, c.title, co.name as company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    ORDER BY c.created_at DESC
    LIMIT 15
  `).bind(orgId).all();

  // Fetch companies summary
  const companies = await db.prepare(`
    SELECT co.id, co.name, co.industry,
      (SELECT COUNT(*) FROM deals WHERE company_id = co.id) as deal_count
    FROM companies co
    WHERE co.owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    ORDER BY co.name
    LIMIT 15
  `).bind(orgId).all();

  // Fetch pipeline metrics
  const pipelineMetrics = await db.prepare(`
    SELECT stage, COUNT(*) as count, SUM(value) as total_value
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
      ${orgFilter}
    GROUP BY stage
  `).bind(orgId).all();

  // Build compact context
  let context = `## CRM DATA

### SALES TEAM (${salesReps.results.length} reps)
`;
  for (const rep of salesReps.results as any[]) {
    context += `• ${rep.name} (${rep.role}): ${rep.active_deals} active deals, $${(rep.pipeline_value || 0).toLocaleString()} pipeline, ${rep.won_deals} won\n`;
  }

  context += `\n### DEALS (${deals.results.length} shown)\n`;
  for (const deal of deals.results as any[]) {
    context += `• ${deal.name}: $${(deal.value || 0).toLocaleString()}, ${deal.stage}, ${deal.company_name || 'No company'}, Owner: ${deal.owner_name || 'Unassigned'}, SPIN: ${deal.spin_progress}/4\n`;
  }

  context += `\n### CONTACTS (${contacts.results.length} shown)\n`;
  for (const contact of contacts.results as any[]) {
    context += `• ${contact.name}: ${contact.title || 'No title'} at ${contact.company_name || 'N/A'}\n`;
  }

  context += `\n### COMPANIES (${companies.results.length} shown)\n`;
  for (const company of companies.results as any[]) {
    context += `• ${company.name}: ${company.industry || 'N/A'}, ${company.deal_count} deals\n`;
  }

  context += `\n### PIPELINE SUMMARY\n`;
  let totalPipeline = 0;
  for (const metric of pipelineMetrics.results as any[]) {
    context += `• ${metric.stage}: ${metric.count} deals, $${(metric.total_value || 0).toLocaleString()}\n`;
    totalPipeline += metric.total_value || 0;
  }
  context += `• TOTAL PIPELINE: $${totalPipeline.toLocaleString()}\n`;

  return context;
}

// Extract SPIN insights from text
ai.post('/extract-spin', async (c) => {
  const { text, dealId } = await c.req.json();

  if (!text) {
    return c.json({ success: false, error: 'Text is required' }, 400);
  }

  try {
    const response = await groqChat(c.env.GROQ_API_KEY, [
      {
        role: 'system',
        content: `You are a sales assistant that extracts SPIN selling insights from conversations and notes.
SPIN stands for:
- Situation: Facts about the customer's current state, context, and background
- Problem: Difficulties, issues, or dissatisfaction the customer experiences
- Implication: Consequences or effects of the problems
- Need-Payoff: Value or benefits the customer would gain from solving problems

Extract insights from the provided text and return ONLY valid JSON in this format:
{
  "situation": ["insight 1", "insight 2"],
  "problem": ["problem 1"],
  "implication": ["implication 1"],
  "needPayoff": ["benefit 1"]
}

If a category has no insights, use an empty array. Return ONLY the JSON, no other text.`,
      },
      {
        role: 'user',
        content: text,
      },
    ], { maxTokens: 512 });

    let insights = {
      situation: [] as string[],
      problem: [] as string[],
      implication: [] as string[],
      needPayoff: [] as string[],
    };

    try {
      const responseText = response.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // If dealId provided, update the deal
    if (dealId && (insights.situation.length || insights.problem.length || insights.implication.length || insights.needPayoff.length)) {
      const deal = await c.env.DB.prepare('SELECT spin_situation, spin_problem, spin_implication, spin_need_payoff FROM deals WHERE id = ?').bind(dealId).first<{
        spin_situation: string;
        spin_problem: string;
        spin_implication: string;
        spin_need_payoff: string;
      }>();

      if (deal) {
        const updates: string[] = [];
        const params: any[] = [];

        if (insights.situation.length) {
          const existing = deal.spin_situation || '';
          const newValue = existing ? `${existing}\n${insights.situation.join('\n')}` : insights.situation.join('\n');
          updates.push('spin_situation = ?');
          params.push(newValue);
        }
        if (insights.problem.length) {
          const existing = deal.spin_problem || '';
          const newValue = existing ? `${existing}\n${insights.problem.join('\n')}` : insights.problem.join('\n');
          updates.push('spin_problem = ?');
          params.push(newValue);
        }
        if (insights.implication.length) {
          const existing = deal.spin_implication || '';
          const newValue = existing ? `${existing}\n${insights.implication.join('\n')}` : insights.implication.join('\n');
          updates.push('spin_implication = ?');
          params.push(newValue);
        }
        if (insights.needPayoff.length) {
          const existing = deal.spin_need_payoff || '';
          const newValue = existing ? `${existing}\n${insights.needPayoff.join('\n')}` : insights.needPayoff.join('\n');
          updates.push('spin_need_payoff = ?');
          params.push(newValue);
        }

        if (updates.length) {
          let progress = 0;
          if (deal.spin_situation || insights.situation.length) progress++;
          if (deal.spin_problem || insights.problem.length) progress++;
          if (deal.spin_implication || insights.implication.length) progress++;
          if (deal.spin_need_payoff || insights.needPayoff.length) progress++;

          updates.push('spin_progress = ?');
          params.push(progress);
          updates.push('updated_at = ?');
          params.push(new Date().toISOString());
          params.push(dealId);

          await c.env.DB.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
        }
      }
    }

    return c.json({ success: true, data: insights });
  } catch (error) {
    console.error('AI extraction error:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract SPIN insights';
    return c.json({ success: false, error: message }, 500);
  }
});

// Get SPIN question suggestions
ai.post('/spin-suggestions', async (c) => {
  const { dealId, industry, companySize, currentStage } = await c.req.json();

  let context = '';

  if (dealId) {
    const deal = await c.env.DB.prepare(`
      SELECT d.*, c.name as contact_name, co.name as company_name, co.industry, co.employee_count
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.id = ?
    `).bind(dealId).first();

    if (deal) {
      context = `
Deal: ${deal.name}
Company: ${deal.company_name || 'Unknown'}
Industry: ${(deal as any).industry || industry || 'Unknown'}
Company Size: ${(deal as any).employee_count || companySize || 'Unknown'}
Current Stage: ${deal.stage}
Situation Notes: ${deal.spin_situation || 'None'}
Problem Notes: ${deal.spin_problem || 'None'}
Implication Notes: ${deal.spin_implication || 'None'}
Need-Payoff Notes: ${deal.spin_need_payoff || 'None'}
`;
    }
  }

  try {
    const response = await groqChat(c.env.GROQ_API_KEY, [
      {
        role: 'system',
        content: `You are a sales coach helping reps ask better SPIN selling questions.
Based on the deal context, suggest 1-2 questions for each SPIN category that hasn't been fully explored.
Focus on the categories that are empty or have minimal information.

Return ONLY valid JSON in this format:
{
  "situation": [{"question": "question text", "reason": "why ask this"}],
  "problem": [{"question": "question text", "reason": "why ask this"}],
  "implication": [{"question": "question text", "reason": "why ask this"}],
  "needPayoff": [{"question": "question text", "reason": "why ask this"}]
}

Keep questions conversational and natural. Return ONLY the JSON, no other text.`,
      },
      {
        role: 'user',
        content: context || `Industry: ${industry || 'Technology'}, Company Size: ${companySize || 'Unknown'}, Stage: ${currentStage || 'lead'}`,
      },
    ], { maxTokens: 768 });

    let suggestions = {
      situation: [] as { question: string; reason: string }[],
      problem: [] as { question: string; reason: string }[],
      implication: [] as { question: string; reason: string }[],
      needPayoff: [] as { question: string; reason: string }[],
    };

    try {
      const responseText = response.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    return c.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('AI suggestion error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions';
    return c.json({ success: false, error: message }, 500);
  }
});

// Get AI insights for dashboard
ai.get('/insights', async (c) => {
  try {
    const user = c.get('user');
    const orgId = user?.organization_id;

    if (!orgId) {
      return c.json({ success: true, data: [] });
    }

    const deals = await c.env.DB.prepare(`
      SELECT
        d.id, d.name, d.value, d.stage, d.spin_progress,
        d.spin_situation, d.spin_problem, d.spin_implication, d.spin_need_payoff,
        co.name as company_name,
        CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage,
        CAST((julianday('now') - julianday(COALESCE((SELECT MAX(created_at) FROM activities WHERE deal_id = d.id), d.created_at))) AS INTEGER) as days_since_activity
      FROM deals d
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.owner_id IN (SELECT id FROM users WHERE organization_id = ?)
      ORDER BY d.value DESC
      LIMIT 10
    `).bind(orgId).all();

    let context = `## ACTIVE PIPELINE WITH SPIN STATUS\n`;

    for (const deal of deals.results as any[]) {
      const hasS = deal.spin_situation ? '✓' : '✗';
      const hasP = deal.spin_problem ? '✓' : '✗';
      const hasI = deal.spin_implication ? '✓' : '✗';
      const hasN = deal.spin_need_payoff ? '✓' : '✗';
      context += `• [${deal.id}] ${deal.name}: $${(deal.value || 0).toLocaleString()}, ${deal.stage}, SPIN[S:${hasS} P:${hasP} I:${hasI} N:${hasN}], ${deal.days_in_stage}d in stage\n`;
    }

    const response = await groqChat(c.env.GROQ_API_KEY, [
      {
        role: 'system',
        content: `You are a SPIN selling expert coach. Analyze this pipeline and give 2-3 actionable insights based on SPIN methodology.

SPIN FRAMEWORK:
- S (Situation): Understanding customer's current state - needed early
- P (Problem): Identifying pains/challenges - critical for urgency
- I (Implication): Consequences of not solving - creates urgency
- N (Need-Payoff): Value of solution - needed before proposal

Return ONLY valid JSON array:
[
  {"type": "risk|suggestion", "title": "Max 6 words", "description": "One SPIN-focused action for [Deal Name]", "deal_id": "the_deal_id"}
]

IMPORTANT:
- Use the DEAL NAME (after the brackets) when mentioning deals in title and description
- Use the deal_id (from inside the brackets [deal_id]) ONLY in the deal_id field
- Example: For "[abc123] Acme Enterprise", use "Acme Enterprise" in description, "abc123" in deal_id`,
      },
      {
        role: 'user',
        content: context,
      },
    ], { maxTokens: 500 });

    let insights = [];
    try {
      const responseText = response.content || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      const weakDeal = (deals.results as any[]).find(d => d.spin_progress < 2);
      if (weakDeal) {
        insights = [{
          type: 'risk',
          title: 'Incomplete discovery',
          description: `${weakDeal.name} needs Problem and Implication questions to build urgency.`,
          deal_id: weakDeal.id,
        }];
      }
    }

    return c.json({ success: true, data: insights });
  } catch (error) {
    console.error('AI insights error:', error);
    // Return error info in development, empty array in production
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg.includes('Rate limit')) {
      return c.json({ success: true, data: [], error: 'rate_limited' });
    }
    return c.json({ success: true, data: [], error: errorMsg });
  }
});

// Get rate limit status
ai.get('/rate-limit-status', async (c) => {
  const status = getRateLimitStatus();
  return c.json({ success: true, data: status });
});

// ==========================================
// Multi-turn Chat
// ==========================================

ai.post('/chat', async (c) => {
  const { messages } = await c.req.json();

  if (!messages || !Array.isArray(messages)) {
    return c.json({ success: false, error: 'Messages array is required' }, 400);
  }

  if (messages.length > 20) {
    return c.json({ success: false, error: 'Maximum 20 messages allowed' }, 400);
  }

  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return c.json({ success: false, error: 'Each message must have role and content' }, 400);
    }
    if (msg.content.length > 2000) {
      return c.json({ success: false, error: 'Each message must be 2000 characters or less' }, 400);
    }
  }

  if (!c.env.GROQ_API_KEY) {
    return c.json({ success: false, error: 'AI service is not configured' }, 500);
  }

  try {
    const user = c.get('user');
    const crmContext = await getCRMContext(c.env.DB, user.organization_id || user.id);

    const systemMessage = {
      role: 'system' as const,
      content: `You are a sharp, experienced sales coach. You have access to the user's CRM data below. Answer their questions directly and concisely — no filler, no over-formatting. Talk like a trusted advisor, not a report generator.

Here is their CRM data:
${crmContext}

Guidelines:
- Answer exactly what's asked. If they ask "how many deals" just give the number and relevant context.
- Be conversational and natural. Write like you're talking to them, not generating a document.
- Only use bullet points or bold when it genuinely helps readability. Don't force structure.
- Keep responses focused. A 2-sentence answer is often better than a 10-bullet breakdown.
- When coaching, be direct and honest. Call out risks, suggest specific next steps.
- Use SPIN methodology knowledge when relevant (Situation, Problem, Implication, Need-Payoff).`,
    };

    const llmMessages = [systemMessage, ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))];

    const response = await groqChat(c.env.GROQ_API_KEY, llmMessages, { maxTokens: 1024 });

    return c.json({
      success: true,
      data: {
        response: response.content,
        usage: response.usage,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to process chat';
    if (errorMsg.includes('Rate limit')) {
      return c.json({
        success: true,
        data: { response: "I'm currently at my request limit. Please wait about a minute and try again." },
      });
    }
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// ==========================================
// Speech-to-Text
// ==========================================

ai.post('/stt', async (c) => {
  if (!c.env.GROQ_API_KEY) {
    return c.json({ success: false, error: 'AI service is not configured' }, 500);
  }

  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as unknown as { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string } | null;

    if (!audioFile || typeof audioFile === 'string' || !audioFile.arrayBuffer) {
      return c.json({ success: false, error: 'Audio file is required' }, 400);
    }

    if (audioFile.size > 5 * 1024 * 1024) {
      return c.json({ success: false, error: 'Audio file must be under 5MB' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await groqSTT(c.env.GROQ_API_KEY, audioBuffer, audioFile.type || 'audio/webm');

    return c.json({ success: true, data: { text: result.text } });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to transcribe audio';
    console.error('AI STT error:', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// ==========================================
// Text-to-Speech
// ==========================================

ai.post('/tts', async (c) => {
  if (!c.env.GROQ_API_KEY) {
    return c.json({ success: false, error: 'AI service is not configured' }, 500);
  }

  try {
    const { text, voice } = await c.req.json();

    if (!text || typeof text !== 'string') {
      return c.json({ success: false, error: 'Text is required' }, 400);
    }

    if (text.length > 200) {
      return c.json({ success: false, error: 'Text must be 200 characters or less' }, 400);
    }

    const audioBuffer = await groqTTS(c.env.GROQ_API_KEY, text, voice);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate speech';
    console.error('AI TTS error:', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default ai;
