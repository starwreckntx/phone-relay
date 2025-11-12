import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
export interface ConferenceState {
    conferenceSid: string;
    conferenceName: string;
    participants: Set<string>;
    killTimer?: NodeJS.Timeout;
    startTime: Date;
}
export declare class ConferenceService implements OnModuleDestroy {
    private configService;
    private logger;
    private readonly twilioClient;
    private readonly conferences;
    private readonly AUTO_HANGUP_MS;
    constructor(configService: ConfigService, logger: LoggerService);
    onModuleDestroy(): void;
    getConferenceByName(name: string): ConferenceState | undefined;
    getConferenceBySid(sid: string): ConferenceState | undefined;
    handleConferenceStart(conferenceSid: string, conferenceName: string): void;
    handleParticipantJoin(conferenceSid: string, callSid: string, participantLabel?: string): void;
    handleParticipantLeave(conferenceSid: string, callSid: string): void;
    handleConferenceEnd(conferenceSid: string): void;
    addParticipant(conferenceName: string, targetNumber: string, fromNumber?: string): Promise<{
        success: boolean;
        callSid?: string;
        error?: string;
    }>;
    forwardCall(conferenceName: string, targetNumber: string, dropAgentLeg?: boolean, fromNumber?: string): Promise<{
        success: boolean;
        callSid?: string;
        error?: string;
    }>;
    endConference(conferenceName: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    private cleanupConference;
    private getStatusCallbackUrl;
}
