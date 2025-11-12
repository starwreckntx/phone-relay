import { LoggerService as NestLoggerService } from '@nestjs/common';
interface LogContext {
    callSid?: string;
    conferenceSid?: string;
    conferenceName?: string;
    event?: string;
    intent?: string;
    error?: any;
    [key: string]: any;
}
export declare class LoggerService implements NestLoggerService {
    private formatMessage;
    log(message: string, context?: LogContext): void;
    error(message: string, trace?: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    verbose(message: string, context?: LogContext): void;
}
export {};
