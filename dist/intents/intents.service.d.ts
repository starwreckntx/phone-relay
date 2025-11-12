import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { ContactsService } from '../contacts/contacts.service';
export interface ParsedIntent {
    intent: 'add' | 'forward' | 'end' | 'none';
    target_name?: string;
    target_number?: string;
    confidence: 'high' | 'medium' | 'low';
}
export declare class IntentsService {
    private configService;
    private logger;
    private contactsService;
    private readonly llmEndpoint;
    private readonly llmApiKey;
    constructor(configService: ConfigService, logger: LoggerService, contactsService: ContactsService);
    parseIntent(transcript: string, callSid?: string): Promise<ParsedIntent>;
    private tryRegexParsing;
    private resolveTarget;
    private parseLLMIntent;
}
