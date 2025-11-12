"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaStreamGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../common/logger/logger.service");
const intents_service_1 = require("../intents/intents.service");
const conference_service_1 = require("../conference/conference.service");
const sdk_1 = require("@deepgram/sdk");
let MediaStreamGateway = class MediaStreamGateway {
    configService;
    logger;
    intentsService;
    conferenceService;
    server;
    deepgramApiKey;
    sessions = new Map();
    deepgramConnections = new Map();
    constructor(configService, logger, intentsService, conferenceService) {
        this.configService = configService;
        this.logger = logger;
        this.intentsService = intentsService;
        this.conferenceService = conferenceService;
        this.deepgramApiKey = this.configService.get('stt.apiKey') || '';
    }
    handleConnection(client, request) {
        this.logger.log('WebSocket client connected', {
            event: 'ws-connection',
        });
        client.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                await this.handleMessage(client, data);
            }
            catch (error) {
                this.logger.error('Error handling WS message', error.message, {
                    error,
                });
            }
        });
        client.on('error', (error) => {
            this.logger.error('WebSocket client error', error.message, { error });
        });
    }
    handleDisconnect(client) {
        const metadata = this.sessions.get(client);
        this.logger.log('WebSocket client disconnected', {
            callSid: metadata?.callSid,
            event: 'ws-disconnect',
        });
        const deepgram = this.deepgramConnections.get(client);
        if (deepgram) {
            try {
                deepgram.finish();
            }
            catch (error) {
                this.logger.error('Error closing Deepgram connection', error.message);
            }
            this.deepgramConnections.delete(client);
        }
        this.sessions.delete(client);
    }
    async handleMessage(client, data) {
        const { event } = data;
        switch (event) {
            case 'start':
                await this.handleStart(client, data);
                break;
            case 'media':
                await this.handleMedia(client, data);
                break;
            case 'stop':
                this.handleStop(client, data);
                break;
            default:
                this.logger.debug('Unknown event type', { event });
        }
    }
    async handleStart(client, data) {
        const { start, streamSid, callSid, customParameters } = data;
        const metadata = {
            callSid: callSid || customParameters?.callSid,
            conferenceName: customParameters?.conferenceName,
            caller: customParameters?.caller,
        };
        this.sessions.set(client, metadata);
        this.logger.log('Media stream started', {
            streamSid,
            callSid: metadata.callSid,
            conferenceName: metadata.conferenceName,
            event: 'stream-start',
        });
        await this.initializeDeepgram(client, metadata);
    }
    async initializeDeepgram(client, metadata) {
        try {
            const deepgram = (0, sdk_1.createClient)(this.deepgramApiKey);
            const connection = deepgram.listen.live({
                encoding: 'mulaw',
                sample_rate: 8000,
                channels: 1,
                model: 'nova-2',
                smart_format: true,
                interim_results: true,
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Open, () => {
                this.logger.debug('Deepgram connection opened', {
                    callSid: metadata.callSid,
                });
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript;
                const isFinal = data.is_final;
                if (transcript && isFinal) {
                    this.logger.log('Transcript received', {
                        callSid: metadata.callSid,
                        transcript,
                        event: 'transcript',
                    });
                    const intent = await this.intentsService.parseIntent(transcript, metadata.callSid);
                    if (intent.intent !== 'none') {
                        this.logger.log('Intent detected', {
                            callSid: metadata.callSid,
                            intent: intent.intent,
                            target: intent.target_number || intent.target_name,
                        });
                        await this.executeIntent(intent, metadata);
                    }
                }
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Error, (error) => {
                this.logger.error('Deepgram error', error.message, {
                    callSid: metadata.callSid,
                    error,
                });
            });
            connection.on(sdk_1.LiveTranscriptionEvents.Close, () => {
                this.logger.debug('Deepgram connection closed', {
                    callSid: metadata.callSid,
                });
            });
            this.deepgramConnections.set(client, connection);
        }
        catch (error) {
            this.logger.error('Failed to initialize Deepgram', error.message, {
                callSid: metadata.callSid,
                error,
            });
        }
    }
    async handleMedia(client, data) {
        const deepgram = this.deepgramConnections.get(client);
        if (!deepgram) {
            return;
        }
        const { media } = data;
        if (media && media.payload) {
            try {
                const audioBuffer = Buffer.from(media.payload, 'base64');
                deepgram.send(audioBuffer);
            }
            catch (error) {
                const metadata = this.sessions.get(client);
                this.logger.error('Error sending audio to Deepgram', error.message, {
                    callSid: metadata?.callSid,
                    error,
                });
            }
        }
    }
    handleStop(client, data) {
        const metadata = this.sessions.get(client);
        this.logger.log('Media stream stopped', {
            callSid: metadata?.callSid,
            event: 'stream-stop',
        });
        const deepgram = this.deepgramConnections.get(client);
        if (deepgram) {
            try {
                deepgram.finish();
            }
            catch (error) {
                this.logger.error('Error finishing Deepgram', error.message);
            }
            this.deepgramConnections.delete(client);
        }
    }
    async executeIntent(intent, metadata) {
        const { conferenceName } = metadata;
        switch (intent.intent) {
            case 'add':
                if (intent.target_number) {
                    await this.conferenceService.addParticipant(conferenceName, intent.target_number);
                }
                else {
                    this.logger.warn('Add intent without target number', {
                        callSid: metadata.callSid,
                        intent,
                    });
                }
                break;
            case 'forward':
                if (intent.target_number) {
                    await this.conferenceService.forwardCall(conferenceName, intent.target_number, false);
                }
                else {
                    this.logger.warn('Forward intent without target number', {
                        callSid: metadata.callSid,
                        intent,
                    });
                }
                break;
            case 'end':
                await this.conferenceService.endConference(conferenceName);
                break;
            default:
                this.logger.debug('Unhandled intent', {
                    callSid: metadata.callSid,
                    intent: intent.intent,
                });
        }
    }
};
exports.MediaStreamGateway = MediaStreamGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], MediaStreamGateway.prototype, "server", void 0);
exports.MediaStreamGateway = MediaStreamGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/media-stream' }),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService,
        intents_service_1.IntentsService,
        conference_service_1.ConferenceService])
], MediaStreamGateway);
//# sourceMappingURL=media-stream.gateway.js.map