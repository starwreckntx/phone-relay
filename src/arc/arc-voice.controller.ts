import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';
import { LoggerService } from '../common/logger/logger.service';
import { ArcService } from './arc.service';

/**
 * AI receptionist: ARC answers the phone. Point a Twilio number (or TwiML App)
 * Voice Request URL at POST /voice/arc/incoming. The flow is a turn-based
 * loop using Twilio's built-in speech recognition (<Gather input="speech">)
 * and speech synthesis (<Say>), so no Deepgram/TTS keys are needed here — the
 * only external call is to ARC's /api/arc/chat brain.
 *
 * Owner route: when the shadow agent is enabled and shadow.ownerNumber matches
 * the caller's From, the call redirects to /voice/shadow/incoming instead — so
 * the owner summons Shadow while everyone else still reaches ARC.
 */
@ApiExcludeController()
@Controller('voice/arc')
export class ArcVoiceController {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly arc: ArcService,
  ) {}

  private get voice(): string {
    return this.config.get<string>('arc.voice') || 'Google.en-US-Studio-O';
  }

  private get greeting(): string {
    return (
      this.config.get<string>('arc.greeting') ||
      "Hi, you've reached Hue and Logic. I'm ARC, the studio's assistant. How can I help you today?"
    );
  }

  private get maxTurns(): number {
    return this.config.get<number>('arc.maxTurns') || 20;
  }

  /** True when this caller is the owner and the shadow agent should answer. */
  private isOwnerSummon(from: string | undefined): boolean {
    if (!from) return false;
    if (!this.config.get<boolean>('shadow.enabled')) return false;
    const owner = this.config.get<string>('shadow.ownerNumber') || '';
    if (!owner) return false;
    // Normalize both sides to digits-only for a tolerant match.
    const digits = (s: string) => s.replace(/\D/g, '');
    const a = digits(from);
    const b = digits(owner);
    return a === b || a.endsWith(b) || b.endsWith(a);
  }

  // A caller signalling they're finished.
  private isEndPhrase(text: string): boolean {
    return /\b(good\s?bye|bye bye|that'?s all|that is all|nothing else|hang up|no thank you|no thanks|we'?re done|i'?m done)\b/i.test(
      text,
    );
  }

  private gatherSpeech(twiml: Twilio.twiml.VoiceResponse, prompt?: string) {
    const gather = twiml.gather({
      input: ['speech'],
      action: '/voice/arc/reply',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
      actionOnEmptyResult: true,
    } as any);
    if (prompt) gather.say({ voice: this.voice as any }, prompt);
    return gather;
  }

  private send(res: Response, twiml: Twilio.twiml.VoiceResponse): void {
    res.type('text/xml');
    res.send(twiml.toString());
  }

  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  async incoming(@Body() body: any, @Res() res: Response): Promise<void> {
    const { CallSid, From } = body || {};
    this.logger.log('ARC receptionist: incoming call', {
      callSid: CallSid,
      from: From,
      event: 'arc-incoming',
    });

    const twiml = new Twilio.twiml.VoiceResponse();

    // Owner calling in? Hand the call to the shadow agent.
    if (this.isOwnerSummon(From)) {
      this.logger.log('Owner summon detected — routing to Shadow', {
        callSid: CallSid,
        event: 'shadow-summon',
      });
      twiml.redirect('/voice/shadow/incoming');
      return this.send(res, twiml);
    }

    if (CallSid) this.arc.reset(CallSid);

    if (!this.arc.isConfigured()) {
      twiml.say(
        { voice: this.voice as any },
        'Sorry, the assistant is not available right now. Please try again later.',
      );
      twiml.hangup();
    } else {
      this.gatherSpeech(twiml, this.greeting);
    }
    this.send(res, twiml);
  }

  @Post('reply')
  @HttpCode(HttpStatus.OK)
  async reply(@Body() body: any, @Res() res: Response): Promise<void> {
    const { CallSid, SpeechResult } = body || {};
    const said = String(SpeechResult || '').trim();
    const twiml = new Twilio.twiml.VoiceResponse();

    // No speech captured — reprompt once, then wrap up gracefully.
    if (!said) {
      if (this.arc.turnsFor(CallSid) === 0) {
        this.gatherSpeech(
          twiml,
          "Sorry, I didn't hear anything. What can I help you with?",
        );
      } else {
        twiml.say({ voice: this.voice as any }, 'Okay, take care. Goodbye.');
        twiml.hangup();
        if (CallSid) this.arc.reset(CallSid);
      }
      return this.send(res, twiml);
    }

    // Caller signalled the end of the conversation.
    if (this.isEndPhrase(said)) {
      twiml.say(
        { voice: this.voice as any },
        'Thanks for calling Hue and Logic. Goodbye.',
      );
      twiml.hangup();
      if (CallSid) this.arc.reset(CallSid);
      return this.send(res, twiml);
    }

    let reply: string;
    try {
      reply = await this.arc.respond(CallSid, said);
    } catch {
      reply =
        "Sorry, I'm having trouble reaching my system right now. Please try again in a moment.";
    }

    twiml.say({ voice: this.voice as any }, reply);

    if (this.arc.turnsFor(CallSid) >= this.maxTurns) {
      twiml.say(
        { voice: this.voice as any },
        "Let's pick this up another time. Goodbye.",
      );
      twiml.hangup();
      if (CallSid) this.arc.reset(CallSid);
    } else {
      // Continue the conversation.
      this.gatherSpeech(twiml);
    }
    this.send(res, twiml);
  }
}
