
import { Controller, Post, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import Twilio from 'twilio';

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle incoming Twilio call' })
  @ApiResponse({ status: 200, description: 'TwiML response returned', type: String })
  async handleIncomingCall(
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    const { CallSid, From, To } = body;

    this.logger.log('Incoming call received', {
      callSid: CallSid,
      from: From,
      to: To,
      event: 'incoming-call',
    });

    const twiml = new Twilio.twiml.VoiceResponse();

    // Add <Gather> for DTMF input (optional, always accepts calls)
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 2,
      action: '/voice/accept',
      actionOnEmptyResult: true,
    });

    // Optional greeting message
    gather.say('Welcome. Press any key or wait to continue.');

    // Fallback if no DTMF (will redirect to accept anyway)
    twiml.redirect('/voice/accept');

    res.type('text/xml');
    res.send(twiml.toString());
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept call and start conference with media stream' })
  @ApiResponse({ status: 200, description: 'TwiML response with conference and stream' })
  async acceptCall(@Body() body: any, @Res() res: Response): Promise<void> {
    const { CallSid, From, Digits } = body;

    this.logger.log('Call accepted', {
      callSid: CallSid,
      from: From,
      digits: Digits,
      event: 'call-accepted',
    });

    const twiml = new Twilio.twiml.VoiceResponse();

    // Generate unique conference name
    const conferenceName = `conf_${CallSid}`;

    // Start bidirectional media stream
    const connect = twiml.connect();
    const stream = connect.stream({
      url: this.configService.get<string>('voiceAgent.wsUrl'),
    });

    // Add custom parameters to stream
    stream.parameter({ name: 'conferenceName', value: conferenceName });
    stream.parameter({ name: 'caller', value: From });
    stream.parameter({ name: 'callSid', value: CallSid });

    // Dial into conference
    const dial = twiml.dial();
    dial.conference(
      {
        statusCallback: this.getConferenceStatusCallbackUrl(),
        statusCallbackEvent: ['start', 'end', 'join', 'leave'],
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
      },
      conferenceName,
    );

    this.logger.log('Conference and stream started', {
      callSid: CallSid,
      conferenceName,
      from: From,
    });

    res.type('text/xml');
    res.send(twiml.toString());
  }

  private getConferenceStatusCallbackUrl(): string {
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    return `${baseUrl}/conference/events`;
  }
}
