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
exports.IntentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../common/logger/logger.service");
const contacts_service_1 = require("../contacts/contacts.service");
const phone_util_1 = require("../common/utils/phone.util");
let IntentsService = class IntentsService {
    configService;
    logger;
    contactsService;
    llmEndpoint;
    llmApiKey;
    constructor(configService, logger, contactsService) {
        this.configService = configService;
        this.logger = logger;
        this.contactsService = contactsService;
        this.llmEndpoint = this.configService.get('llm.endpoint') || '';
        this.llmApiKey = this.configService.get('llm.apiKey') || '';
    }
    async parseIntent(transcript, callSid) {
        const regexResult = this.tryRegexParsing(transcript);
        if (regexResult.confidence === 'high') {
            this.logger.log('Intent parsed via regex', {
                callSid,
                transcript,
                intent: regexResult.intent,
            });
            return regexResult;
        }
        try {
            const llmResult = await this.parseLLMIntent(transcript);
            this.logger.log('Intent parsed via LLM', {
                callSid,
                transcript,
                intent: llmResult.intent,
            });
            return llmResult;
        }
        catch (error) {
            this.logger.error('LLM intent parsing failed', error.message, {
                callSid,
                transcript,
                error,
            });
            return { intent: 'none', confidence: 'low' };
        }
    }
    tryRegexParsing(transcript) {
        const text = transcript.toLowerCase().trim();
        const addPatterns = [
            /(?:add|call|dial|connect)\s+(.+)/i,
            /(?:bring\s+in|conference\s+in)\s+(.+)/i,
        ];
        for (const pattern of addPatterns) {
            const match = text.match(pattern);
            if (match) {
                const target = match[1].trim();
                return this.resolveTarget(target, 'add');
            }
        }
        const forwardPatterns = [
            /(?:forward|transfer)\s+(?:to|call)?\s*(.+)/i,
            /(?:send|redirect)\s+(?:to)?\s*(.+)/i,
        ];
        for (const pattern of forwardPatterns) {
            const match = text.match(pattern);
            if (match) {
                const target = match[1].trim();
                return this.resolveTarget(target, 'forward');
            }
        }
        const endPatterns = [
            /hang\s*up/i,
            /end\s+(?:the\s+)?call/i,
            /disconnect/i,
            /goodbye/i,
            /bye\s*bye/i,
        ];
        for (const pattern of endPatterns) {
            if (pattern.test(text)) {
                return { intent: 'end', confidence: 'high' };
            }
        }
        return { intent: 'none', confidence: 'low' };
    }
    resolveTarget(target, intent) {
        const phoneNumber = (0, phone_util_1.extractPhoneNumber)(target);
        if (phoneNumber) {
            const normalized = (0, phone_util_1.normalizeToE164)(phoneNumber);
            if (normalized) {
                return {
                    intent,
                    target_number: normalized,
                    confidence: 'high',
                };
            }
        }
        const contactNumber = this.contactsService.getContact(target);
        if (contactNumber) {
            return {
                intent,
                target_name: target,
                target_number: contactNumber,
                confidence: 'high',
            };
        }
        return {
            intent,
            target_name: target,
            confidence: 'medium',
        };
    }
    async parseLLMIntent(transcript) {
        const systemPrompt = `You are an intent parser for a voice telephony system. Parse user voice commands into structured intents.

Valid intents:
- "add": User wants to add a third party to the call (3-way calling). Extract target name or number.
- "forward": User wants to forward/transfer the call to someone. Extract target name or number.
- "end": User wants to end/hang up the call.
- "none": No clear intent detected.

Respond ONLY with valid JSON in this format:
{"intent": "add|forward|end|none", "target_name": "optional name", "target_number": "optional number"}`;
        const response = await fetch(this.llmEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.llmApiKey}`,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcript },
                ],
                stream: false,
                response_format: { type: 'json_object' },
            }),
        });
        if (!response.ok) {
            throw new Error(`LLM API error: ${response.status}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('No content in LLM response');
        }
        const parsed = JSON.parse(content);
        if (parsed.target_number) {
            const normalized = (0, phone_util_1.normalizeToE164)(parsed.target_number);
            if (normalized) {
                parsed.target_number = normalized;
            }
        }
        if (parsed.target_name && !parsed.target_number) {
            const contactNumber = this.contactsService.getContact(parsed.target_name);
            if (contactNumber) {
                parsed.target_number = contactNumber;
            }
        }
        return {
            ...parsed,
            confidence: 'medium',
        };
    }
};
exports.IntentsService = IntentsService;
exports.IntentsService = IntentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService,
        contacts_service_1.ContactsService])
], IntentsService);
//# sourceMappingURL=intents.service.js.map