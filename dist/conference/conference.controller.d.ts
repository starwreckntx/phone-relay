import { ConferenceService } from './conference.service';
import { LoggerService } from '../common/logger/logger.service';
import { AddParticipantDto, ForwardCallDto, EndConferenceDto } from './dto/conference.dto';
export declare class ConferenceController {
    private readonly conferenceService;
    private readonly logger;
    constructor(conferenceService: ConferenceService, logger: LoggerService);
    handleConferenceEvents(body: any): Promise<void>;
    addParticipant(dto: AddParticipantDto): Promise<{
        success: boolean;
        callSid?: string;
        error?: string;
    }>;
    forwardCall(dto: ForwardCallDto): Promise<{
        success: boolean;
        callSid?: string;
        error?: string;
    }>;
    endConference(dto: EndConferenceDto): Promise<{
        success: boolean;
        error?: string;
    }>;
}
