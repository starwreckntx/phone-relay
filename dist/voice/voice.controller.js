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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../common/logger/logger.service");
const twilio_1 = __importDefault(require("twilio"));
let VoiceController = class VoiceController {
    configService;
    logger;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    async handleIncomingCall(body, res) {
        const { CallSid, From, To } = body;
        this.logger.log('Incoming call received', {
            callSid: CallSid,
            from: From,
            to: To,
            event: 'incoming-call',
        });
        const twiml = new twilio_1.default.twiml.VoiceResponse();
        const gather = twiml.gather({
            numDigits: 1,
            timeout: 2,
            action: '/voice/accept',
            actionOnEmptyResult: true,
        });
        gather.say('Welcome. Press any key or wait to continue.');
        twiml.redirect('/voice/accept');
        res.type('text/xml');
        res.send(twiml.toString());
    }
    async acceptCall(body, res) {
        const { CallSid, From, Digits } = body;
        this.logger.log('Call accepted', {
            callSid: CallSid,
            from: From,
            digits: Digits,
            event: 'call-accepted',
        });
        const twiml = new twilio_1.default.twiml.VoiceResponse();
        const conferenceName = `conf_${CallSid}`;
        const connect = twiml.connect();
        const stream = connect.stream({
            url: this.configService.get('voiceAgent.wsUrl'),
        });
        stream.parameter({ name: 'conferenceName', value: conferenceName });
        stream.parameter({ name: 'caller', value: From });
        stream.parameter({ name: 'callSid', value: CallSid });
        const dial = twiml.dial();
        dial.conference({
            statusCallback: this.getConferenceStatusCallbackUrl(),
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],
            startConferenceOnEnter: true,
            endConferenceOnExit: false,
        }, conferenceName);
        this.logger.log('Conference and stream started', {
            callSid: CallSid,
            conferenceName,
            from: From,
        });
        res.type('text/xml');
        res.send(twiml.toString());
    }
    getConferenceStatusCallbackUrl() {
        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
        return `${baseUrl}/conference/events`;
    }
};
exports.VoiceController = VoiceController;
__decorate([
    (0, common_1.Post)('incoming'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Handle incoming Twilio call' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'TwiML response returned', type: String }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VoiceController.prototype, "handleIncomingCall", null);
__decorate([
    (0, common_1.Post)('accept'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Accept call and start conference with media stream' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'TwiML response with conference and stream' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VoiceController.prototype, "acceptCall", null);
exports.VoiceController = VoiceController = __decorate([
    (0, swagger_1.ApiTags)('voice'),
    (0, common_1.Controller)('voice'),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], VoiceController);
//# sourceMappingURL=voice.controller.js.map