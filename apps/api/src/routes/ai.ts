import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { groqChat, groqSTT, groqTTS, getRateLimitStatus } from '../utils/groq';
import { strictRateLimiter, aiAudioRateLimiter } from '../middleware/rate-limit';
import { logger } from '../utils/logger';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

ai.use('*', clerkAuthMiddleware);
// Apply strict rate limiting to most AI routes (expensive API calls)
// TTS uses a separate, higher-limit rate limiter
ai.use('/extract-spin', strictRateLimiter);
ai.use('/spin-suggestions', strictRateLimiter);
ai.use('/insights', strictRateLimiter);
ai.use('/chat', strictRateLimiter);
ai.use('/stt', strictRateLimiter);
ai.use('/tts', aiAudioRateLimiter);

// Helper to fetch compact CRM context for AI (optimized for token limits)
// SECURITY: Requires org_id to prevent cross-tenant data leakage
async function getCRMContext(db: D1Database, orgId: string): Promise<string> {
  // Fetch sales reps with their performance metrics - filtered by org_id
  const salesReps = await db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.job_function,
      COUNT(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN 1 END) as active_deals,
      COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.value END), 0) as pipeline_value,
      COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END) as deals_won,
      COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.value END), 0) as revenue_won,
      AVG(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.spin_progress END) as avg_spin_progress,
      AVG(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) END) as avg_days_in_stage,
      COUNT(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') AND d.spin_progress < 2 THEN 1 END) as deals_needing_discovery
    FROM users u
    LEFT JOIN deals d ON d.owner_id = u.id AND d.org_id = ?
    WHERE u.org_id = ?
    GROUP BY u.id, u.name, u.email, u.job_function
    ORDER BY pipeline_value DESC
  `).bind(orgId, orgId).all();

  // Fetch deals with key info only - filtered by org_id
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
    WHERE d.org_id = ?
    ORDER BY d.value DESC
    LIMIT 20
  `).bind(orgId).all();

  // Fetch contacts summary - filtered by org_id
  const contacts = await db.prepare(`
    SELECT c.id, c.name, c.email, c.title, co.name as company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.org_id = ?
    ORDER BY c.created_at DESC
    LIMIT 15
  `).bind(orgId).all();

  // Fetch companies summary - filtered by org_id
  const companies = await db.prepare(`
    SELECT co.id, co.name, co.industry,
      (SELECT COUNT(*) FROM deals WHERE company_id = co.id AND org_id = ?) as deal_count
    FROM companies co
    WHERE co.org_id = ?
    ORDER BY co.name
    LIMIT 15
  `).bind(orgId, orgId).all();

  // Fetch pipeline metrics - filtered by org_id
  const pipelineMetrics = await db.prepare(`
    SELECT stage, COUNT(*) as count, SUM(value) as total_value
    FROM deals
    WHERE org_id = ? AND stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
  `).bind(orgId).all();

  // Build compact context
  let context = `## CRM DATA

### SALES REPS (${salesReps.results.length} team members)
`;

  for (const rep of salesReps.results as any[]) {
    const role = rep.job_function ? rep.job_function.toUpperCase() : 'REP';
    const avgSpin = rep.avg_spin_progress !== null ? (rep.avg_spin_progress as number).toFixed(1) : '0';
    const avgDays = rep.avg_days_in_stage !== null ? Math.round(rep.avg_days_in_stage as number) : 0;
    context += `• ${rep.name} (${role}): ${rep.active_deals} active deals, $${(rep.pipeline_value || 0).toLocaleString()} pipeline, ${rep.deals_won} won ($${(rep.revenue_won || 0).toLocaleString()}), Avg SPIN: ${avgSpin}/4, Avg ${avgDays}d in stage, ${rep.deals_needing_discovery} needs discovery\n`;
  }

  context += `\n### DEALS (${deals.results.length} shown)
`;

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

  // Input length validation to prevent abuse
  const maxTextLength = 10000;
  if (text.length > maxTextLength) {
    return c.json({ success: false, error: `Text exceeds maximum length of ${maxTextLength} characters` }, 400);
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
      logger.warn('Failed to parse AI extraction response', { action: 'ai_parse_error', endpoint: 'extract-spin' });
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
    logger.error('AI SPIN extraction failed', error, { action: 'ai_error', endpoint: 'extract-spin' });
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
      logger.warn('Failed to parse AI suggestion response', { action: 'ai_parse_error', endpoint: 'spin-suggestions' });
    }

    return c.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('AI suggestion generation failed', error, { action: 'ai_error', endpoint: 'spin-suggestions' });
    const message = error instanceof Error ? error.message : 'Failed to generate suggestions';
    return c.json({ success: false, error: message }, 500);
  }
});

// Get AI insights for dashboard
ai.get('/insights', async (c) => {
  const orgId = c.get('orgId');

  // SECURITY: If no organization is selected, return empty insights
  // This prevents data leakage between organizations
  if (!orgId) {
    return c.json({ success: true, data: [] }, 200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
  }

  try {
    // Get pipeline context for AI with SPIN details - orgId is guaranteed to exist at this point
    const deals = await c.env.DB.prepare(`
      SELECT
        d.id, d.name, d.value, d.stage, d.spin_progress,
        d.spin_situation, d.spin_problem, d.spin_implication, d.spin_need_payoff,
        co.name as company_name,
        CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage,
        CAST((julianday('now') - julianday(COALESCE((SELECT MAX(created_at) FROM activities WHERE deal_id = d.id), d.created_at))) AS INTEGER) as days_since_activity
      FROM deals d
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.org_id = ? AND d.stage NOT IN ('closed_won', 'closed_lost')
      ORDER BY d.value DESC
      LIMIT 10
    `).bind(orgId).all();

    // Build context for AI with SPIN focus
    let context = `## ACTIVE PIPELINE WITH SPIN STATUS\n`;
    const dealMap: Record<string, string> = {}; // name -> id mapping

    for (const deal of deals.results as any[]) {
      dealMap[deal.name] = deal.id;
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

INSIGHT PRIORITIES:
1. Deals missing Problem or Implication (can't create urgency)
2. Deals in Proposal/Negotiation with incomplete SPIN (risk of stalling)
3. High-value deals with weak discovery
4. Deals stuck too long in a stage

Return ONLY valid JSON array:
[
  {"type": "risk|suggestion", "title": "Max 6 words", "description": "One SPIN-focused action", "deal_id": "the_deal_id"}
]

IMPORTANT: Include the deal_id from the brackets [deal_id] for each insight.
Be specific about which SPIN element is missing and why it matters.`,
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
      logger.warn('Failed to parse AI insights response', { action: 'ai_parse_error', endpoint: 'insights' });
      // Fallback to SPIN-based insight
      const weakDeal = (deals.results as any[]).find(d => d.spin_progress < 2);
      if (weakDeal) {
        insights = [
          {
            type: 'risk',
            title: 'Incomplete discovery',
            description: `${weakDeal.name} needs Problem and Implication questions to build urgency.`,
            deal_id: weakDeal.id,
          },
        ];
      }
    }

    return c.json({ success: true, data: insights });
  } catch (error) {
    logger.error('AI insights generation failed', error, { action: 'ai_error', endpoint: 'insights' });
    return c.json({ success: true, data: [] });
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
  const orgId = c.get('orgId');

  // SECURITY: Require organization to be selected for AI chat
  // This prevents data leakage between organizations
  if (!orgId) {
    return c.json({ success: false, error: 'Please select an organization to use AI features' }, 403);
  }

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
    const crmContext = await getCRMContext(c.env.DB, orgId);

    const systemMessage = {
      role: 'system' as const,
      content: `You are an elite sales coach and VP of Sales with 20+ years closing enterprise deals. You're direct, strategic, and focused on WINNING. You help reps prioritize ruthlessly, identify risks early, and close deals faster.

## YOUR CRM DATA
${crmContext}

## YOUR COACHING STYLE
- Be DIRECT and ACTION-ORIENTED - tell them exactly what to do
- Prioritize by REVENUE IMPACT - always focus on biggest opportunities first
- Call out RISKS and BLOCKERS proactively
- Use SPIN methodology (Situation, Problem, Implication, Need-Payoff)
- Give specific NEXT STEPS with names and actions
- Challenge weak pipeline and missing discovery data

## SALES REP COACHING
- You have full visibility into each rep's performance metrics
- Track active deals, pipeline value, won deals, and SPIN progress per rep
- Identify reps who are falling behind (high avg days in stage, low SPIN progress)
- Know which reps need help with discovery (deals_needing_discovery > 0)
- Help managers understand team performance and where to focus coaching
- When asked about a specific rep, give detailed analysis of their pipeline

## RESPONSE FORMAT (CRITICAL)
1. Use markdown with **bold** for names, numbers, priorities
2. Each item on its OWN LINE with bullet points
3. Use ## headers to organize
4. End with clear NEXT ACTIONS
5. Keep it concise - busy reps need quick answers

Always give your honest assessment. If a deal looks weak, say so. If a rep is struggling, be direct about it. Your job is to help them WIN.`,
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
    logger.error('AI chat failed', error, { action: 'ai_error', endpoint: 'chat' });

    if (errorMsg.includes('Rate limit')) {
      return c.json({
        success: true,
        data: {
          response: "I'm currently at my request limit. Please wait about a minute and try again.",
        },
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

    // 5MB limit
    if (audioFile.size > 5 * 1024 * 1024) {
      return c.json({ success: false, error: 'Audio file must be under 5MB' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await groqSTT(c.env.GROQ_API_KEY, audioBuffer, audioFile.type || 'audio/webm');

    return c.json({ success: true, data: { text: result.text } });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to transcribe audio';
    logger.error('AI STT failed', error, { action: 'ai_error', endpoint: 'stt' });
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
    logger.error('AI TTS failed', error, { action: 'ai_error', endpoint: 'tts' });
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default ai;
