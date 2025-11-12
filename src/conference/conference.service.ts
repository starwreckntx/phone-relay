
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import Twilio from 'twilio';

export interface ConferenceState {
  conferenceSid: string;
  conferenceName: string;
  participants: Set<string>;
  killTimer?: NodeJS.Timeout;
  startTime: Date;
}

@Injectable()
export class ConferenceService implements OnModuleDestroy {
  private readonly twilioClient: Twilio.Twilio;
  private readonly conferences = new Map<string, ConferenceState>();
  private readonly AUTO_HANGUP_MS = 20 * 60 * 1000; // 20 minutes

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.twilioClient = Twilio(accountSid, authToken);
  }

  onModuleDestroy() {
    // Clean up all timers on shutdown
    for (const [name, state] of this.conferences.entries()) {
      if (state.killTimer) {
        clearTimeout(state.killTimer);
        this.logger.log('Cleared kill timer on shutdown', {
          conferenceName: name,
        });
      }
    }
  }

  getConferenceByName(name: string): ConferenceState | undefined {
    return this.conferences.get(name);
  }

  getConferenceBySid(sid: string): ConferenceState | undefined {
    for (const state of this.conferences.values()) {
      if (state.conferenceSid === sid) {
        return state;
      }
    }
    return undefined;
  }

  handleConferenceStart(conferenceSid: string, conferenceName: string): void {
    const state: ConferenceState = {
      conferenceSid,
      conferenceName,
      participants: new Set(),
      startTime: new Date(),
    };

    // Arm 20-minute auto-hangup timer
    state.killTimer = setTimeout(() => {
      this.logger.log('Auto-hangup timer triggered', {
        conferenceSid,
        conferenceName,
      });
      this.endConference(conferenceName);
    }, this.AUTO_HANGUP_MS);

    this.conferences.set(conferenceName, state);

    this.logger.log('Conference started', {
      conferenceSid,
      conferenceName,
      event: 'conference-start',
    });
  }

  handleParticipantJoin(
    conferenceSid: string,
    callSid: string,
    participantLabel?: string,
  ): void {
    const state = this.getConferenceBySid(conferenceSid);
    if (state) {
      state.participants.add(callSid);
      this.logger.log('Participant joined conference', {
        conferenceSid,
        conferenceName: state.conferenceName,
        callSid,
        participantLabel,
        participantCount: state.participants.size,
        event: 'participant-join',
      });
    }
  }

  handleParticipantLeave(conferenceSid: string, callSid: string): void {
    const state = this.getConferenceBySid(conferenceSid);
    if (state) {
      state.participants.delete(callSid);
      this.logger.log('Participant left conference', {
        conferenceSid,
        conferenceName: state.conferenceName,
        callSid,
        participantCount: state.participants.size,
        event: 'participant-leave',
      });

      // If no participants left, clean up
      if (state.participants.size === 0) {
        this.cleanupConference(state.conferenceName);
      }
    }
  }

  handleConferenceEnd(conferenceSid: string): void {
    const state = this.getConferenceBySid(conferenceSid);
    if (state) {
      this.logger.log('Conference ended', {
        conferenceSid,
        conferenceName: state.conferenceName,
        event: 'conference-end',
      });
      this.cleanupConference(state.conferenceName);
    }
  }

  async addParticipant(
    conferenceName: string,
    targetNumber: string,
    fromNumber?: string,
  ): Promise<{ success: boolean; callSid?: string; error?: string }> {
    const state = this.getConferenceByName(conferenceName);
    if (!state) {
      return { success: false, error: 'Conference not found' };
    }

    try {
      const from = fromNumber || this.configService.get<string>('twilio.phoneNumber') || '';
      
      const call = await this.twilioClient.calls.create({
        from,
        to: targetNumber,
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference statusCallback="${this.getStatusCallbackUrl()}" statusCallbackEvent="start end join leave">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`,
      });

      this.logger.log('Added participant to conference', {
        conferenceSid: state.conferenceSid,
        conferenceName,
        targetNumber,
        newCallSid: call.sid,
        intent: 'add',
      });

      return { success: true, callSid: call.sid };
    } catch (error) {
      this.logger.error('Failed to add participant', error.message, {
        conferenceName,
        targetNumber,
        error,
      });
      return { success: false, error: error.message };
    }
  }

  async forwardCall(
    conferenceName: string,
    targetNumber: string,
    dropAgentLeg: boolean = false,
    fromNumber?: string,
  ): Promise<{ success: boolean; callSid?: string; error?: string }> {
    const state = this.getConferenceByName(conferenceName);
    if (!state) {
      return { success: false, error: 'Conference not found' };
    }

    try {
      const from = fromNumber || this.configService.get<string>('twilio.phoneNumber') || '';

      // Add the forward target
      const call = await this.twilioClient.calls.create({
        from,
        to: targetNumber,
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference statusCallback="${this.getStatusCallbackUrl()}" statusCallbackEvent="start end join leave">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`,
      });

      this.logger.log('Forwarded call', {
        conferenceSid: state.conferenceSid,
        conferenceName,
        targetNumber,
        dropAgentLeg,
        intent: 'forward',
      });

      // Optionally drop agent leg
      if (dropAgentLeg) {
        // This would require tracking which participant is the agent
        // For simplicity, we'll just log the intent
        this.logger.log('Agent leg drop requested (requires participant tracking)', {
          conferenceName,
        });
      }

      return { success: true, callSid: call.sid };
    } catch (error) {
      this.logger.error('Failed to forward call', error.message, {
        conferenceName,
        targetNumber,
        error,
      });
      return { success: false, error: error.message };
    }
  }

  async endConference(conferenceName: string): Promise<{ success: boolean; error?: string }> {
    const state = this.getConferenceByName(conferenceName);
    if (!state) {
      return { success: false, error: 'Conference not found' };
    }

    try {
      await this.twilioClient
        .conferences(state.conferenceSid)
        .update({ status: 'completed' });

      this.logger.log('Conference ended via API', {
        conferenceSid: state.conferenceSid,
        conferenceName,
        intent: 'end',
      });

      this.cleanupConference(conferenceName);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to end conference', error.message, {
        conferenceName,
        error,
      });
      return { success: false, error: error.message };
    }
  }

  private cleanupConference(conferenceName: string): void {
    const state = this.conferences.get(conferenceName);
    if (state?.killTimer) {
      clearTimeout(state.killTimer);
    }
    this.conferences.delete(conferenceName);
    this.logger.log('Conference cleaned up', { conferenceName });
  }

  private getStatusCallbackUrl(): string {
    // This should be the public URL for /conference/events
    // In production, it will be the deployed URL
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
    return `${baseUrl}/conference/events`;
  }
}
