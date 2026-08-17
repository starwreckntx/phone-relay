import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';

interface Turn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallState {
  history: Turn[];
  turns: number;
  lastActivity: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are Shadow, a private voice agent for the person calling you — their summoned counterpart, not a receptionist.

How you speak on a phone call:
- Replies are short: 1-3 sentences unless the caller asks for depth.
- Plain spoken English. No markdown, bullets, emoji, or URLs.
- Spell out numbers, times, and symbols the way you'd say them.
- You have full conversation memory within this call; use it.
- If the caller says goodbye or asks to hang up, give a brief sign-off.`;

/**
 * ShadowService is the "brain" of the shadow agent: a per-call voice
 * conversation keyed by Twilio CallSid. It talks to any OpenAI-compatible
 * chat endpoint (the purpbox Kimi shim by default), keeping its own system
 * prompt and history so the persona is independent of ARC/the site.
 *
 * Unlike ARC, Shadow executes no actions — it's a conversational agent.
 * State is best-effort (in memory, pruned after 60 min of inactivity).
 */
@Injectable()
export class ShadowService {
  private readonly chatUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly timeoutMs: number;
  private readonly calls = new Map<string, CallState>();
  private readonly TTL_MS = 60 * 60 * 1000;
  // How many trailing conversation turns (user/assistant) to send alongside the
  // system prompt. The system turn is always kept — see respond().
  private readonly HISTORY_WINDOW = 24;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.chatUrl = this.config.get<string>('shadow.chatUrl') || '';
    this.apiKey = this.config.get<string>('shadow.apiKey') || '';
    this.model = this.config.get<string>('shadow.model') || 'kimi-for-coding';
    this.systemPrompt =
      this.config.get<string>('shadow.systemPrompt') || DEFAULT_SYSTEM_PROMPT;
    this.timeoutMs = this.config.get<number>('shadow.timeoutMs') || 20000;
  }

  isConfigured(): boolean {
    return Boolean(this.chatUrl);
  }

  turnsFor(callSid: string): number {
    return this.calls.get(callSid)?.turns ?? 0;
  }

  reset(callSid: string): void {
    this.calls.delete(callSid);
  }

  private prune(): void {
    const now = Date.now();
    for (const [sid, state] of this.calls.entries()) {
      if (now - state.lastActivity > this.TTL_MS) this.calls.delete(sid);
    }
  }

  /**
   * Flatten markdown into clean prose for <Say> — same rules as ARC:
   * TTS should never read asterisks, backticks, or list markers aloud.
   */
  private toSpeech(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*`~]+/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\r/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, '. ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.!?])(?:\s*\.)+\s*/g, '$1 ')
      .trim();
  }

  /**
   * One conversational turn. Throws on transport/backend failure so the
   * controller can speak a fallback instead of dead air.
   */
  async respond(callSid: string, userText: string): Promise<string> {
    this.prune();

    const state: CallState = this.calls.get(callSid) || {
      history: [{ role: 'system', content: this.systemPrompt }],
      turns: 0,
      lastActivity: Date.now(),
    };
    state.history.push({ role: 'user', content: userText.slice(0, 8000) });
    state.turns += 1;
    state.lastActivity = Date.now();
    this.calls.set(callSid, state);

    // Always keep the system turn (history[0]); cap only the conversation tail.
    // A plain slice(-N) would slide past index 0 on long calls and drop the
    // persona entirely, so separate the system turn out before windowing.
    const [systemTurn, ...convo] = state.history;
    const messages = [systemTurn, ...convo.slice(-this.HISTORY_WINDOW)];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
        signal: controller.signal,
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          data?.error?.message || data?.error || `status ${res.status}`;
        this.logger.error('Shadow chat request failed', String(err), {
          callSid,
          status: res.status,
        });
        throw new Error(String(err));
      }

      const prose: string = String(
        data?.choices?.[0]?.message?.content ?? '',
      ).trim();
      const spoken =
        this.toSpeech(prose) ||
        "Sorry, I didn't quite catch that. Say it another way?";

      state.history.push({ role: 'assistant', content: prose || spoken });
      this.calls.set(callSid, state);

      this.logger.log('Shadow reply', {
        callSid,
        turns: state.turns,
        event: 'shadow-reply',
      });
      return spoken;
    } finally {
      clearTimeout(timer);
    }
  }
}
