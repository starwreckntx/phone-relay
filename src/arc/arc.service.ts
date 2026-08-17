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
  briefSent: boolean;
}

interface ArcAction {
  type: string;
  payload?: Record<string, any>;
}

/**
 * ArcService is the "brain" of the AI receptionist. It relays a caller's
 * transcribed speech to ARC — the same assistant that runs on the website —
 * via its public /api/arc/chat endpoint, and returns ARC's spoken reply.
 *
 * ARC ends a message with at most one fenced ```json {"action":{...}}``` block.
 * On a phone call the page-oriented actions (navigate/highlight/open/call) are
 * no-ops, but the `email` action IS the "take a message / send a brief" path —
 * we execute it by forwarding its payload (name/email/message/…) to the site's
 * /api/contact endpoint, which delivers it via Resend. Without this, ARC would
 * say "sending now" while nothing was actually sent.
 *
 * Per-call conversation history is kept in memory keyed by Twilio CallSid so
 * ARC has context across turns. State is best-effort (cleared on restart) and
 * pruned after inactivity.
 */
@Injectable()
export class ArcService {
  private readonly chatUrl: string;
  private readonly briefUrl: string;
  private readonly timeoutMs: number;
  private readonly maxTurns: number;
  private readonly calls = new Map<string, CallState>();
  private readonly TTL_MS = 15 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.chatUrl = this.config.get<string>('arc.chatUrl') || '';
    this.briefUrl =
      this.config.get<string>('arc.briefUrl') ||
      'https://hueandlogic.com/api/contact';
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
   * Split ARC's reply into the prose it should speak and the trailing action
   * envelope (if any). The JSON block is never spoken.
   */
  private parseEnvelope(reply: string): { spoken: string; action: ArcAction | null } {
    const match = reply.match(/```json\s*([\s\S]*?)```\s*$/i);
    if (!match || match.index === undefined) {
      return { spoken: reply.trim(), action: null };
    }
    const spoken = reply.slice(0, match.index).trim();
    try {
      const parsed = JSON.parse(match[1].trim());
      const action = parsed?.action;
      return { spoken, action: action?.type ? action : null };
    } catch {
      // Malformed envelope — speak the prose, execute nothing.
      return { spoken, action: null };
    }
  }

  /**
   * Flatten ARC's chat markdown into clean prose for <Say>. TTS should never
   * read asterisks, backticks, list dashes, or blockquote markers aloud, and
   * line breaks become natural sentence pauses.
   */
  private toSpeech(text: string): string {
    return text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [label](url) -> label
      .replace(/[*`~]+/g, '') // bold / italic / code / strike markers
      .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
      .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
      .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
      .replace(/^\s*\d+\.\s+/gm, '') // numbered-list markers
      .replace(/\r/g, '')
      .replace(/\n{2,}/g, '. ') // paragraph break -> sentence pause
      .replace(/\n/g, '. ') // line break -> pause
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1') // no space before punctuation
      .replace(/([.!?])(?:\s*\.)+\s*/g, '$1 ') // collapse doubled stops
      .trim();
  }

  /**
   * Deliver a captured brief to the studio via the site's /api/contact
   * (Resend-backed) endpoint. Best-effort; returns whether it was accepted.
   */
  private async deliverBrief(
    callSid: string,
    payload: Record<string, any> | undefined,
  ): Promise<boolean> {
    const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
    const name = str(payload?.name);
    const email = str(payload?.email);
    const message = str(payload?.message);
    // ARC's own rule for emitting `email`: at least name + email + message.
    if (!name || !email || !message) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.briefUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          phone: str(payload?.phone) || undefined,
          company: str(payload?.company) || undefined,
          reason: str(payload?.reason) || 'ARC phone receptionist',
        }),
        signal: controller.signal,
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false || body?.ok === false) {
        this.logger.error(
          'ARC brief delivery failed',
          String(body?.error || res.status),
          { callSid, status: res.status },
        );
        return false;
      }
      this.logger.log('ARC brief delivered to studio', {
        callSid,
        event: 'arc-brief-sent',
      });
      return true;
    } catch (err: any) {
      this.logger.error('ARC brief delivery error', err?.message || 'unknown', {
        callSid,
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Send the caller's utterance to ARC and return the text ARC should speak.
   * Throws on transport/backend failure so the controller can fall back to a
   * spoken apology rather than dead air.
   */
  async respond(callSid: string, userText: string): Promise<string> {
    this.prune();

    const state: CallState = this.calls.get(callSid) || {
      history: [],
      turns: 0,
      lastActivity: Date.now(),
      briefSent: false,
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

      const { spoken: prose, action } = this.parseEnvelope(
        String(data.reply ?? ''),
      );
      let spoken =
        this.toSpeech(prose) ||
        "Sorry, I didn't quite catch that. Could you say it another way?";

      // The only action worth executing on a voice call: send the brief.
      // (navigate/highlight/open/call target a web page and are ignored here.)
      if (action?.type === 'email' && !state.briefSent) {
        const sent = await this.deliverBrief(callSid, action.payload);
        if (sent) {
          state.briefSent = true;
        } else {
          // ARC's prose usually says it sent — stay honest if it didn't.
          spoken +=
            " I wasn't able to send that just now — you can also reach the studio through the contact page at hueandlogic.com.";
        }
      }

      // Store ARC's prose (not our fallback note) so context stays clean.
      state.history.push({ role: 'assistant', content: prose || spoken });
      this.calls.set(callSid, state);

      this.logger.log('ARC receptionist reply', {
        callSid,
        turns: state.turns,
        action: action?.type,
        briefSent: state.briefSent,
        event: 'arc-reply',
      });
      return spoken;
    } finally {
      clearTimeout(timer);
    }
  }
}
