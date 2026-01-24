import Groq from 'groq-sdk';

// Groq Free Tier Limits for llama-3.1-8b-instant
const RATE_LIMITS = {
  requestsPerMinute: 30,
  tokensPerMinute: 6000,
  tokensPerDay: 500000,
};

// Model to use (optimized for free tier)
export const GROQ_MODEL = 'llama-3.1-8b-instant';

// Simple in-memory rate limiter for Cloudflare Workers
// In production, consider using KV for distributed rate limiting
interface RateLimitState {
  minuteRequests: number;
  minuteTokens: number;
  dayTokens: number;
  minuteReset: number;
  dayReset: number;
}

const state: RateLimitState = {
  minuteRequests: 0,
  minuteTokens: 0,
  dayTokens: 0,
  minuteReset: Date.now() + 60000,
  dayReset: Date.now() + 86400000,
};

function checkAndResetLimits(): void {
  const now = Date.now();
  if (now >= state.minuteReset) {
    state.minuteRequests = 0;
    state.minuteTokens = 0;
    state.minuteReset = now + 60000;
  }
  if (now >= state.dayReset) {
    state.dayTokens = 0;
    state.dayReset = now + 86400000;
  }
}

function canMakeRequest(estimatedTokens: number = 1000): { allowed: boolean; waitMs?: number; reason?: string } {
  checkAndResetLimits();

  if (state.minuteRequests >= RATE_LIMITS.requestsPerMinute) {
    return {
      allowed: false,
      waitMs: state.minuteReset - Date.now(),
      reason: 'Rate limit: too many requests per minute',
    };
  }

  if (state.minuteTokens + estimatedTokens > RATE_LIMITS.tokensPerMinute) {
    return {
      allowed: false,
      waitMs: state.minuteReset - Date.now(),
      reason: 'Rate limit: token limit per minute reached',
    };
  }

  if (state.dayTokens + estimatedTokens > RATE_LIMITS.tokensPerDay) {
    return {
      allowed: false,
      waitMs: state.dayReset - Date.now(),
      reason: 'Rate limit: daily token limit reached',
    };
  }

  return { allowed: true };
}

function recordUsage(tokens: number): void {
  state.minuteRequests++;
  state.minuteTokens += tokens;
  state.dayTokens += tokens;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function groqChat(
  apiKey: string,
  messages: ChatMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<GroqResponse> {
  const { maxTokens = 1024, temperature = 0.7 } = options;

  // Estimate tokens (rough: 4 chars per token)
  const estimatedInputTokens = messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
  const estimatedTotalTokens = estimatedInputTokens + maxTokens;

  // Check rate limits
  const limitCheck = canMakeRequest(estimatedTotalTokens);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason || 'Rate limit exceeded');
  }

  const client = new Groq({ apiKey });

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const usage = {
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    totalTokens: completion.usage?.total_tokens || 0,
  };

  // Record actual usage
  recordUsage(usage.totalTokens);

  return {
    content: completion.choices[0]?.message?.content || '',
    usage,
  };
}

export function getRateLimitStatus(): {
  minuteRequests: number;
  minuteTokens: number;
  dayTokens: number;
  limits: typeof RATE_LIMITS;
} {
  checkAndResetLimits();
  return {
    minuteRequests: state.minuteRequests,
    minuteTokens: state.minuteTokens,
    dayTokens: state.dayTokens,
    limits: RATE_LIMITS,
  };
}

export interface STTResponse {
  text: string;
}

export async function groqSTT(
  apiKey: string,
  audioBlob: Blob | ArrayBuffer,
  mimeType: string = 'audio/webm'
): Promise<STTResponse> {
  const formData = new FormData();
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = new File(
    [audioBlob instanceof ArrayBuffer ? new Uint8Array(audioBlob) : audioBlob],
    `audio.${ext}`,
    { type: mimeType }
  );
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`STT request failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<STTResponse>;
}

export async function groqTTS(
  apiKey: string,
  text: string,
  voice: string = 'tara'
): Promise<ArrayBuffer> {
  const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'playai-tts',
      input: text,
      voice: 'Arista-PlayAI',
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS request failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}
