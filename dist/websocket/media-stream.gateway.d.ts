import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'ws';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { IntentsService } from '../intents/intents.service';
import { ConferenceService } from '../conference/conference.service';
export declare class MediaStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private configService;
    private logger;
    private intentsService;
    private conferenceService;
    server: Server;
    private readonly deepgramApiKey;
    private readonly sessions;
    private readonly deepgramConnections;
    constructor(configService: ConfigService, logger: LoggerService, intentsService: IntentsService, conferenceService: ConferenceService);
    handleConnection(client: any, request: any): void;
    handleDisconnect(client: any): void;
    private handleMessage;
    private handleStart;
    private initializeDeepgram;
    private handleMedia;
    private handleStop;
    private executeIntent;
}
