import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import twilio from 'twilio';

/**
 * Validates Twilio webhook signatures via twilio.validateRequest.
 * Applied to inbound voice webhook controllers.
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authToken = this.configService.get<string>('twilio.authToken');

    // Allow local/dev without a real token configured.
    if (!authToken || authToken === 'your_auth_token') {
      return true;
    }

    const signature = request.headers['x-twilio-signature'] as string | undefined;
    if (!signature) {
      throw new UnauthorizedException('Missing X-Twilio-Signature header');
    }

    const publicUrl = this.configService.get<string>('publicUrl') || process.env.PUBLIC_URL;
    // Reconstruct the full URL Twilio signed. Prefer PUBLIC_URL + originalUrl.
    const url =
      (publicUrl ? `${publicUrl.replace(/\/$/, '')}${request.originalUrl}` : undefined) ||
      `${request.protocol}://${request.get('host')}${request.originalUrl}`;

    const params = (request.body || {}) as Record<string, string>;
    const valid = twilio.validateRequest(authToken, signature, url, params);
    if (!valid) {
      throw new UnauthorizedException('Invalid Twilio request signature');
    }
    return true;
  }
}
