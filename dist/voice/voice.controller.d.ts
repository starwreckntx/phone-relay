import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
export declare class VoiceController {
    private configService;
    private logger;
    constructor(configService: ConfigService, logger: LoggerService);
    handleIncomingCall(body: any, res: Response): Promise<void>;
    acceptCall(body: any, res: Response): Promise<void>;
    private getConferenceStatusCallbackUrl;
}
