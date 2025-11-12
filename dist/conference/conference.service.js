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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../common/logger/logger.service");
const twilio_1 = __importDefault(require("twilio"));
let ConferenceService = class ConferenceService {
    configService;
    logger;
    twilioClient;
    conferences = new Map();
    AUTO_HANGUP_MS = 20 * 60 * 1000;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const accountSid = this.configService.get('twilio.accountSid');
        const authToken = this.configService.get('twilio.authToken');
        this.twilioClient = (0, twilio_1.default)(accountSid, authToken);
    }
    onModuleDestroy() {
        for (const [name, state] of this.conferences.entries()) {
            if (state.killTimer) {
                clearTimeout(state.killTimer);
                this.logger.log('Cleared kill timer on shutdown', {
                    conferenceName: name,
                });
            }
        }
    }
    getConferenceByName(name) {
        return this.conferences.get(name);
    }
    getConferenceBySid(sid) {
        for (const state of this.conferences.values()) {
            if (state.conferenceSid === sid) {
                return state;
            }
        }
        return undefined;
    }
    handleConferenceStart(conferenceSid, conferenceName) {
        const state = {
            conferenceSid,
            conferenceName,
            participants: new Set(),
            startTime: new Date(),
        };
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
    handleParticipantJoin(conferenceSid, callSid, participantLabel) {
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
    handleParticipantLeave(conferenceSid, callSid) {
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
            if (state.participants.size === 0) {
                this.cleanupConference(state.conferenceName);
            }
        }
    }
    handleConferenceEnd(conferenceSid) {
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
    async addParticipant(conferenceName, targetNumber, fromNumber) {
        const state = this.getConferenceByName(conferenceName);
        if (!state) {
            return { success: false, error: 'Conference not found' };
        }
        try {
            const from = fromNumber || this.configService.get('twilio.phoneNumber') || '';
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
        }
        catch (error) {
            this.logger.error('Failed to add participant', error.message, {
                conferenceName,
                targetNumber,
                error,
            });
            return { success: false, error: error.message };
        }
    }
    async forwardCall(conferenceName, targetNumber, dropAgentLeg = false, fromNumber) {
        const state = this.getConferenceByName(conferenceName);
        if (!state) {
            return { success: false, error: 'Conference not found' };
        }
        try {
            const from = fromNumber || this.configService.get('twilio.phoneNumber') || '';
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
            if (dropAgentLeg) {
                this.logger.log('Agent leg drop requested (requires participant tracking)', {
                    conferenceName,
                });
            }
            return { success: true, callSid: call.sid };
        }
        catch (error) {
            this.logger.error('Failed to forward call', error.message, {
                conferenceName,
                targetNumber,
                error,
            });
            return { success: false, error: error.message };
        }
    }
    async endConference(conferenceName) {
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
        }
        catch (error) {
            this.logger.error('Failed to end conference', error.message, {
                conferenceName,
                error,
            });
            return { success: false, error: error.message };
        }
    }
    cleanupConference(conferenceName) {
        const state = this.conferences.get(conferenceName);
        if (state?.killTimer) {
            clearTimeout(state.killTimer);
        }
        this.conferences.delete(conferenceName);
        this.logger.log('Conference cleaned up', { conferenceName });
    }
    getStatusCallbackUrl() {
        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
        return `${baseUrl}/conference/events`;
    }
};
exports.ConferenceService = ConferenceService;
exports.ConferenceService = ConferenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], ConferenceService);
//# sourceMappingURL=conference.service.js.map