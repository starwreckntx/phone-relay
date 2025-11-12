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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const conference_service_1 = require("./conference.service");
const bearer_auth_guard_1 = require("../common/guards/bearer-auth.guard");
const logger_service_1 = require("../common/logger/logger.service");
const conference_dto_1 = require("./dto/conference.dto");
let ConferenceController = class ConferenceController {
    conferenceService;
    logger;
    constructor(conferenceService, logger) {
        this.conferenceService = conferenceService;
        this.logger = logger;
    }
    async handleConferenceEvents(body) {
        const { ConferenceSid, FriendlyName, StatusCallbackEvent, CallSid, ParticipantLabel, } = body;
        this.logger.log('Conference event received', {
            conferenceSid: ConferenceSid,
            conferenceName: FriendlyName,
            event: StatusCallbackEvent,
            callSid: CallSid,
        });
        switch (StatusCallbackEvent) {
            case 'conference-start':
                this.conferenceService.handleConferenceStart(ConferenceSid, FriendlyName);
                break;
            case 'conference-end':
                this.conferenceService.handleConferenceEnd(ConferenceSid);
                break;
            case 'participant-join':
                this.conferenceService.handleParticipantJoin(ConferenceSid, CallSid, ParticipantLabel);
                break;
            case 'participant-leave':
                this.conferenceService.handleParticipantLeave(ConferenceSid, CallSid);
                break;
        }
    }
    async addParticipant(dto) {
        return this.conferenceService.addParticipant(dto.conferenceName, dto.targetNumber, dto.fromNumber);
    }
    async forwardCall(dto) {
        return this.conferenceService.forwardCall(dto.conferenceName, dto.targetNumber, dto.dropAgentLeg, dto.fromNumber);
    }
    async endConference(dto) {
        return this.conferenceService.endConference(dto.conferenceName);
    }
};
exports.ConferenceController = ConferenceController;
__decorate([
    (0, common_1.Post)('conference/events'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Handle Twilio conference status callbacks' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Event processed successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConferenceController.prototype, "handleConferenceEvents", null);
__decorate([
    (0, common_1.Post)('api/conference/add'),
    (0, common_1.UseGuards)(bearer_auth_guard_1.BearerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Add third participant to conference (3-way calling)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Participant added successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [conference_dto_1.AddParticipantDto]),
    __metadata("design:returntype", Promise)
], ConferenceController.prototype, "addParticipant", null);
__decorate([
    (0, common_1.Post)('api/conference/forward'),
    (0, common_1.UseGuards)(bearer_auth_guard_1.BearerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Forward call to target number' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Call forwarded successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [conference_dto_1.ForwardCallDto]),
    __metadata("design:returntype", Promise)
], ConferenceController.prototype, "forwardCall", null);
__decorate([
    (0, common_1.Post)('api/conference/end'),
    (0, common_1.UseGuards)(bearer_auth_guard_1.BearerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'End conference immediately' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Conference ended successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [conference_dto_1.EndConferenceDto]),
    __metadata("design:returntype", Promise)
], ConferenceController.prototype, "endConference", null);
exports.ConferenceController = ConferenceController = __decorate([
    (0, swagger_1.ApiTags)('conference'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [conference_service_1.ConferenceService,
        logger_service_1.LoggerService])
], ConferenceController);
//# sourceMappingURL=conference.controller.js.map