import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { groqChat, getRateLimitStatus } from '../utils/groq';
import { strictRateLimiter } from '../middleware/rate-limit';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

ai.use('*', clerkAuthMiddleware);
// Apply strict rate limiting to AI routes (expensive API calls)
ai.use('*', strictRateLimiter);

// Helper to fetch compact CRM context for AI (optimized for token limits)
async function getCRMContext(db: D1Database): Promise<string> {
  // Fetch deals with key info only
  const deals = await db.prepare(`
    SELECT
      d.id, d.name, d.value, d.stage, d.spin_progress, d.close_date,
      co.name as company_name,
      c.name as contact_name
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    ORDER BY d.value DESC
    LIMIT 20
  `).all();

  // Fetch contacts summary
  const contacts = await db.prepare(`
    SELECT c.id, c.name, c.email, c.title, co.name as company_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    ORDER BY c.created_at DESC
    LIMIT 15
  `).all();

  // Fetch companies summary
  const companies = await db.prepare(`
    SELECT co.id, co.name, co.industry,
      (SELECT COUNT(*) FROM deals WHERE company_id = co.id) as deal_count
    FROM companies co
    ORDER BY co.name
    LIMIT 15
  `).all();

  // Fetch pipeline metrics
  const pipelineMetrics = await db.prepare(`
    SELECT stage, COUNT(*) as count, SUM(value) as total_value
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
  `).all();

  // Build compact context
  let context = `## CRM DATA

### DEALS (${deals.results.length} shown)
`;

  for (const deal of deals.results as any[]) {
    context += `• ${deal.name}: $${(deal.value || 0).toLocaleString()}, ${deal.stage}, ${deal.company_name || 'No company'}, SPIN: ${deal.spin_progress}/4\n`;
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

// Natural language query - FULLY CONTEXT AWARE
ai.post('/query', async (c) => {
  const { query } = await c.req.json();

  if (!query) {
    return c.json({ success: false, error: 'Query is required' }, 400);
  }

  try {
    // Fetch full CRM context
    const crmContext = await getCRMContext(c.env.DB);

    const response = await groqChat(c.env.GROQ_API_KEY, [
      {
        role: 'system',
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

## RESPONSE FORMAT (CRITICAL)
1. Use markdown with **bold** for names, numbers, priorities
2. Each item on its OWN LINE with bullet points
3. Use ## headers to organize
4. End with clear NEXT ACTIONS
5. Keep it concise - busy reps need quick answers

## WEEKLY PRIORITIES FRAMEWORK
When asked about priorities, focus on:
1. **Close This Week** - deals in negotiation with imminent close dates
2. **Advance Stage** - proposals that need follow-up to move forward
3. **At Risk** - deals with no activity, missing SPIN, or stuck
4. **Build Pipeline** - contacts to nurture, new opportunities

Always give your honest assessment. If a deal looks weak, say so. Your job is to help them WIN.`,
      },
      {
        role: 'user',
        content: query,
      },
    ], { maxTokens: 1024 });

    return c.json({
      success: true,
      data: {
        response: response.content,
        usage: response.usage,
      },
    });
  } catch (error) {
    console.error('AI query error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to process query';

    // Check if it's a rate limit error and return a friendly message
    if (errorMsg.includes('Rate limit')) {
      return c.json({
        success: true,
        data: {
          response: "I'm currently at my request limit. Please wait about a minute and try again. The free tier allows 30 requests per minute and 6,000 tokens per minute.",
        },
      });
    }

    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// Get AI insights for dashboard
ai.get('/insights', async (c) => {
  try {
    // Get pipeline context for AI with SPIN details
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
      ORDER BY d.value DESC
      LIMIT 10
    `).all();

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
      console.warn('Failed to parse AI insights:', parseError);
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
    console.error('AI insights error:', error);
    return c.json({ success: true, data: [] });
  }
});

// Get rate limit status
ai.get('/rate-limit-status', async (c) => {
  const status = getRateLimitStatus();
  return c.json({ success: true, data: status });
});

export default ai;
