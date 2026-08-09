import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface CallState {
  history: Turn[];
  turns: number;
  lastActivity: number;
}

/**
 * ArcService is the "brain" of the AI receptionist. It relays a caller's
 * transcribed speech to ARC — the same assistant that runs on the website —
 * via its public /api/arc/chat endpoint, and returns ARC's spoken reply.
 *
 * Per-call conversation history is kept in memory keyed by Twilio CallSid so
 * ARC has context across turns. State is best-effort (cleared on restart) and
 * pruned after inactivity.
 */
@Injectable()
export class ArcService {
  private readonly chatUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTurns: number;
  private readonly calls = new Map<string, CallState>();
  private readonly TTL_MS = 15 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.chatUrl = this.config.get<string>('arc.chatUrl') || '';
    this.timeoutMs = this.config.get<number>('arc.timeoutMs') || 15000;
    this.maxTurns = this.config.get<number>('arc.maxTurns') || 20;
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
   * ARC may append a ```json {...}``` action envelope (navigate/open/email/
   * call) after its prose. On a phone call we speak only the prose and drop
   * any trailing envelope — the receptionist never executes web actions.
   */
  private spokenFromReply(reply: string): string {
    const match = reply.match(/```json[\s\S]*?```\s*$/i);
    const text =
      match && match.index !== undefined ? reply.slice(0, match.index) : reply;
    return text.trim();
  }

  /**
   * Send the caller's utterance to ARC and return the text ARC should speak.
   * Throws on transport/backend failure so the controller can fall back to a
   * spoken apology rather than a dead air.
   */
  async respond(callSid: string, userText: string): Promise<string> {
    this.prune();

    const state: CallState = this.calls.get(callSid) || {
      history: [],
      turns: 0,
      lastActivity: Date.now(),
    };
    state.history.push({ role: 'user', content: userText.slice(0, 8000) });
    state.turns += 1;
    state.lastActivity = Date.now();
    this.calls.set(callSid, state);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Keep the last several turns for context; ARC applies its own system
        // prompt, firewall, and rate limit server-side.
        body: JSON.stringify({
          messages: state.history.slice(-12),
          mode: 'guide',
        }),
        signal: controller.signal,
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        this.logger.error(
          'ARC chat request failed',
          String(data?.error || res.status),
          { callSid, status: res.status },
        );
        throw new Error(String(data?.error || `status ${res.status}`));
      }

      const spoken =
        this.spokenFromReply(String(data.reply ?? '')) ||
        "Sorry, I didn't quite catch that. Could you say it another way?";
      state.history.push({ role: 'assistant', content: spoken });
      this.calls.set(callSid, state);

      this.logger.log('ARC receptionist reply', {
        callSid,
        turns: state.turns,
        event: 'arc-reply',
      });
      return spoken;
    } finally {
      clearTimeout(timer);
    }
  }
}
