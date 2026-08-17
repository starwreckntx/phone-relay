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
import { ShadowService } from './shadow.service';

/**
 * Shadow agent: a private voice agent the owner summons by calling the Twilio
 * number. Same turn-based loop as ARC (<Gather input="speech"> + <Say>), but
 * with its own persona, its own brain endpoint, and no receptionist actions.
 *
 * Direct webhook: point a Twilio Voice Request URL at POST /voice/shadow/incoming.
 * Owner auto-route: when shadow.enabled and shadow.ownerNumber are set, ARC's
 * /voice/arc/incoming redirects matching callers here, so one number serves
 * both agents.
 */
@ApiExcludeController()
@Controller('voice/shadow')
export class ShadowVoiceController {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly shadow: ShadowService,
  ) {}

  private get voice(): string {
    return (
      this.config.get<string>('shadow.voice') || 'Google.en-US-Studio-O'
    );
  }

  private get greeting(): string {
    return (
      this.config.get<string>('shadow.greeting') ||
      "Shadow's here. What are we working on?"
    );
  }

  private get maxTurns(): number {
    return this.config.get<number>('shadow.maxTurns') || 40;
  }

  private isEndPhrase(text: string): boolean {
    return /\b(good\s?bye|bye bye|that'?s all|that is all|nothing else|hang up|no thank you|no thanks|we'?re done|i'?m done|dismiss(ed)?|stand down)\b/i.test(
      text,
    );
  }

  private gatherSpeech(twiml: Twilio.twiml.VoiceResponse, prompt?: string) {
    const gather = twiml.gather({
      input: ['speech'],
      action: '/voice/shadow/reply',
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
    this.logger.log('Shadow agent: incoming call', {
      callSid: CallSid,
      from: From,
      event: 'shadow-incoming',
    });

    if (CallSid) this.shadow.reset(CallSid);

    const twiml = new Twilio.twiml.VoiceResponse();
    if (!this.shadow.isConfigured()) {
      twiml.say(
        { voice: this.voice as any },
        'Shadow is not configured right now. Try again later.',
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
      if (this.shadow.turnsFor(CallSid) === 0) {
        this.gatherSpeech(twiml, "I didn't catch that. What's up?");
      } else {
        twiml.say({ voice: this.voice as any }, 'Going dark. Goodbye.');
        twiml.hangup();
        if (CallSid) this.shadow.reset(CallSid);
      }
      return this.send(res, twiml);
    }

    if (this.isEndPhrase(said)) {
      twiml.say({ voice: this.voice as any }, 'Understood. Shadow out.');
      twiml.hangup();
      if (CallSid) this.shadow.reset(CallSid);
      return this.send(res, twiml);
    }

    let reply: string;
    try {
      reply = await this.shadow.respond(CallSid, said);
    } catch {
      reply =
        "Sorry, I'm having trouble reaching my brain right now. Give me a moment and try again.";
    }

    twiml.say({ voice: this.voice as any }, reply);

    if (this.shadow.turnsFor(CallSid) >= this.maxTurns) {
      twiml.say({ voice: this.voice as any }, "That's a long session. Let's pick it up later. Goodbye.");
      twiml.hangup();
      if (CallSid) this.shadow.reset(CallSid);
    } else {
      this.gatherSpeech(twiml);
    }
    this.send(res, twiml);
  }
}
