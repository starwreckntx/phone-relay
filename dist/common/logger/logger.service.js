"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
let LoggerService = class LoggerService {
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...context,
        };
        return JSON.stringify(logEntry);
    }
    log(message, context) {
        console.log(this.formatMessage('info', message, context));
    }
    error(message, trace, context) {
        console.error(this.formatMessage('error', message, { ...context, trace }));
    }
    warn(message, context) {
        console.warn(this.formatMessage('warn', message, context));
    }
    debug(message, context) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.formatMessage('debug', message, context));
        }
    }
    verbose(message, context) {
        if (process.env.NODE_ENV === 'development') {
            console.log(this.formatMessage('verbose', message, context));
        }
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)()
], LoggerService);
//# sourceMappingURL=logger.service.js.map