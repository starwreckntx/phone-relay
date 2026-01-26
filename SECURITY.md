# Security Guide for Voice Telephony Agent

This document outlines the security architecture, policies, and best practices for deploying and operating the Voice Telephony Agent.

## Table of Contents

- [Security Overview](#security-overview)
- [Always Accept Policy](#always-accept-policy)
- [Bearer Token Authentication](#bearer-token-authentication)
- [Environment Variables Security](#environment-variables-security)
- [API Security](#api-security)
- [Network Security](#network-security)
- [Data Privacy](#data-privacy)
- [Twilio Security](#twilio-security)
- [Security Hardening](#security-hardening)
- [Incident Response](#incident-response)

---

## Security Overview

### Architecture Security Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Network (TLS/WSS)                     │
├─────────────────────────────────────────────────┤
│  Layer 2: Bearer Token Auth (/api/* endpoints) │
├─────────────────────────────────────────────────┤
│  Layer 3: Twilio Request Validation             │
├─────────────────────────────────────────────────┤
│  Layer 4: Environment Variable Isolation        │
├─────────────────────────────────────────────────┤
│  Layer 5: Application Logic (Always-Accept)     │
└─────────────────────────────────────────────────┘
```

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: API tokens with minimal permissions
3. **Secure by Default**: Production-ready defaults
4. **Audit Logging**: Comprehensive event logging
5. **Fail Secure**: Errors don't expose sensitive data

---

## Always Accept Policy

### Policy Description

**CRITICAL**: The Voice Telephony Agent accepts **ALL incoming calls** regardless of DTMF input or caller identity. This is by design for automatic call handling but has security implications.

### Implementation

```typescript
// In voice.controller.ts
@Post('incoming')
async handleIncomingCall(@Body() body: any, @Res() res: Response) {
  // No caller verification
  // No whitelist/blacklist checks
  // Accepts all calls automatically
  
  const gather = twiml.gather({
    timeout: 2,
    actionOnEmptyResult: true, // ← Always accepts
  });
  
  twiml.redirect('/voice/accept'); // ← Fallback accepts
}
```

### Security Implications

#### Risks

1. **Unsolicited Calls**: Service will answer robocalls, spam, etc.
2. **Billing Exposure**: Each accepted call incurs Twilio charges
3. **Resource Consumption**: Spam calls consume compute/memory
4. **Data Exposure**: Call metadata logged for all calls

#### Mitigations

##### 1. Implement Caller Whitelist (Recommended for Production)

```typescript
// Add to voice.controller.ts
const ALLOWED_CALLERS = process.env.CALLER_WHITELIST?.split(',') || [];

@Post('incoming')
async handleIncomingCall(@Body() body: any, @Res() res: Response) {
  const { From } = body;
  
  // Whitelist check
  if (ALLOWED_CALLERS.length > 0 && !ALLOWED_CALLERS.includes(From)) {
    const twiml = new Twilio.twiml.VoiceResponse();
    twiml.say('This number is not authorized.');
    twiml.hangup();
    
    this.logger.warn('Unauthorized caller blocked', { from: From });
    return res.type('text/xml').send(twiml.toString());
  }
  
  // Continue normal flow...
}
```

Add to `.env`:
```env
CALLER_WHITELIST=+12025551234,+12025555678
```

##### 2. Implement Caller Blacklist

```typescript
const BLOCKED_CALLERS = process.env.CALLER_BLACKLIST?.split(',') || [];

if (BLOCKED_CALLERS.includes(From)) {
  const twiml = new Twilio.twiml.VoiceResponse();
  twiml.reject(); // Reject without answering (no charges)
  return res.type('text/xml').send(twiml.toString());
}
```

##### 3. Use Twilio Caller ID Verification

Enable [Twilio CNAM Lookup](https://www.twilio.com/docs/lookup/v2-api):

```typescript
const client = this.twilioClient;
const lookup = await client.lookups.v2
  .phoneNumbers(From)
  .fetch({ fields: 'caller_name' });

if (lookup.callerName?.caller_type === 'BUSINESS') {
  // Allow business calls
} else if (!lookup.callerName) {
  // Block unverified numbers
  twiml.reject();
}
```

##### 4. Rate Limiting

Implement rate limiting to prevent abuse:

```bash
# Install rate limiter
yarn add @nestjs/throttler
```

```typescript
// In app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10, // Max 10 calls per minute
    }),
  ],
})

// Apply to voice controller
@UseGuards(ThrottlerGuard)
@Controller('voice')
export class VoiceController { ... }
```

##### 5. Geographic Restrictions

Block calls from specific countries:

```typescript
const { FromCountry } = body;
const BLOCKED_COUNTRIES = ['CN', 'RU']; // Example

if (BLOCKED_COUNTRIES.includes(FromCountry)) {
  twiml.reject();
  return res.type('text/xml').send(twiml.toString());
}
```

### Testing Always-Accept Behavior

```bash
# Test with any phone number
# All calls should be accepted

# Verify logs show acceptance
tail -f .logs/*.log | grep "call-accepted"
```

---

## Bearer Token Authentication

### Overview

All `/api/*` endpoints require Bearer token authentication to prevent unauthorized access to conference management and contact APIs.

### Implementation

```typescript
// In common/guards/bearer-auth.guard.ts
@Injectable()
export class BearerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    
    const token = authHeader.substring(7);
    const expectedToken = process.env.INTERNAL_API_BEARER;
    
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid token');
    }
    
    return true;
  }
}
```

### Protected Endpoints

- `POST /api/conference/add` - Add participant
- `POST /api/conference/forward` - Forward call
- `POST /api/conference/end` - End conference
- `GET /api/contacts` - Get contacts
- `PUT /api/contacts` - Update contacts

### Unprotected Endpoints

- `POST /voice/incoming` - Twilio webhook (validated by Twilio signature)
- `POST /voice/accept` - Twilio webhook
- `POST /conference/events` - Twilio webhook
- `GET /health` - Public health check

### Token Generation

**CRITICAL**: Generate a cryptographically secure token:

```bash
# Generate 256-bit token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: <your_generated_token_will_appear_here>
```

Add to `.env`:
```env
INTERNAL_API_BEARER=<your_generated_secure_token_here>
```

### Token Rotation

Rotate tokens regularly (every 90 days recommended):

```bash
# Generate new token
NEW_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update environment
export INTERNAL_API_BEARER=$NEW_TOKEN

# Restart service
pm2 restart voice-agent

# Update client applications with new token
```

### Usage Examples

```bash
# Correct usage
curl -X GET http://localhost:3000/api/contacts \
  -H "Authorization: Bearer YOUR_SECURE_TOKEN_HERE"

# Missing token (401)
curl -X GET http://localhost:3000/api/contacts

# Invalid token (401)
curl -X GET http://localhost:3000/api/contacts \
  -H "Authorization: Bearer wrong-token"

# Wrong format (401)
curl -X GET http://localhost:3000/api/contacts \
  -H "Authorization: YOUR_TOKEN" # Missing "Bearer "
```

### Security Best Practices

1. **Never Commit Tokens**: Add `.env` to `.gitignore`
2. **Use Secrets Management**: Store tokens in vault (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Rotate Regularly**: Change tokens every 90 days
4. **Monitor Usage**: Log failed auth attempts
5. **Limit Scope**: Use different tokens for different environments
6. **Audit Access**: Review logs for unauthorized attempts

---

## Environment Variables Security

### Sensitive Variables

The following environment variables contain sensitive data:

- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - **HIGHLY SENSITIVE** - API authentication
- `STT_API_KEY` - Deepgram API key
- `ABACUSAI_API_KEY` - LLM API key
- `INTERNAL_API_BEARER` - **HIGHLY SENSITIVE** - API access token

### Protection Strategies

#### 1. Never Commit to Version Control

```bash
# Verify .gitignore includes .env
cat .gitignore | grep ".env"

# Should see:
# .env
# .env.local
# .env.*.local
```

#### 2. Use Secrets Management Services

**Render.com**:
```bash
# Set secrets via dashboard or CLI
render secrets set TWILIO_AUTH_TOKEN=xxx...
```

**Fly.io**:
```bash
fly secrets set TWILIO_AUTH_TOKEN=xxx...
```

**Google Cloud Run**:
```bash
# Create secret
gcloud secrets create twilio-auth-token --data-file=<(echo "xxx...")

# Grant access
gcloud secrets add-iam-policy-binding twilio-auth-token \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Use in deployment
gcloud run deploy voice-agent \
  --set-secrets "TWILIO_AUTH_TOKEN=twilio-auth-token:latest"
```

#### 3. Environment Separation

Use different credentials for each environment:

```
Development:   TWILIO_ACCOUNT_SID=ACdev123...
Staging:       TWILIO_ACCOUNT_SID=ACstg123...
Production:    TWILIO_ACCOUNT_SID=ACprd123...
```

#### 4. Principle of Least Privilege

Use API keys with minimal permissions:

- **Twilio**: Create separate API keys (not master auth token)
- **Deepgram**: Use project-specific keys
- **Abacus**: Use limited-scope API keys

---

## API Security

### Input Validation

All API inputs are validated using DTOs:

```typescript
// In dto/conference.dto.ts
export class AddParticipantDto {
  @IsString()
  @Matches(/^conf_CA[a-f0-9]{32}$/)
  conferenceName: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/) // E.164 format
  targetNumber: string;
}
```

### Output Sanitization

Sensitive data is excluded from responses:

```typescript
// Don't expose internal state
return {
  success: true,
  message: 'Participant added',
  // Don't include: twilioClient, authToken, etc.
};
```

### Error Handling

Errors don't expose sensitive information:

```typescript
try {
  await this.twilioClient.conferences(sid).update({ status: 'completed' });
} catch (error) {
  // Log detailed error internally
  this.logger.error('Conference end failed', error.message, { error });
  
  // Return generic error to client
  throw new InternalServerErrorException('Failed to end conference');
}
```

### CORS Configuration

Restrict CORS to trusted origins:

```typescript
// In main.ts
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});
```

---

## Network Security

### TLS/HTTPS

**CRITICAL**: Always use HTTPS in production.

```env
# .env for production
VOICE_AGENT_WS_URL=wss://your-domain.com/media-stream  # ← wss:// (secure)
PUBLIC_URL=https://your-domain.com                     # ← https://
```

### WebSocket Security

WebSocket connections use secure WSS protocol:

```typescript
// Client must connect via wss://
const ws = new WebSocket('wss://your-domain.com/media-stream');
```

### Firewall Rules

Only expose necessary ports:

```bash
# Allow only HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP  # Block direct app access
```

---

## Data Privacy

### Logging Sensitivity

Logs contain PII (Personally Identifiable Information):

```json
{
  "timestamp": "2025-11-11T20:00:00.000Z",
  "callSid": "CA1234567890",
  "from": "+12025551234",  // ← PII
  "transcript": "Call John"  // ← PII
}
```

#### Log Retention Policy

```bash
# Rotate logs daily, keep 30 days
logrotate -f /etc/logrotate.d/voice-agent

# Example config:
/app/.logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 nestjs nodejs
}
```

#### GDPR Compliance

Implement data subject access requests:

```typescript
// Endpoint to delete caller data
@Delete('api/data/:phoneNumber')
async deleteUserData(@Param('phoneNumber') phone: string) {
  // Delete from logs, contacts, recordings
  await this.logsService.deleteByPhone(phone);
  await this.contactsService.deleteByPhone(phone);
  return { success: true };
}
```

### Call Recording

**Note**: Current implementation does **NOT** record calls. If you enable recording:

1. **Legal**: Comply with two-party consent laws
2. **Disclosure**: Play announcement before recording
3. **Storage**: Encrypt recordings at rest
4. **Retention**: Implement automatic deletion

---

## Twilio Security

### Webhook Validation

Implement Twilio signature validation to prevent webhook spoofing:

```typescript
// Install validator
yarn add twilio

// In voice.controller.ts
import { validateRequest } from 'twilio';

@Post('incoming')
async handleIncomingCall(@Body() body: any, @Req() req: Request) {
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const url = `${process.env.PUBLIC_URL}/voice/incoming`;
  
  const isValid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    body,
  );
  
  if (!isValid) {
    throw new UnauthorizedException('Invalid Twilio signature');
  }
  
  // Continue normal flow...
}
```

### API Key Best Practices

1. **Use API Keys**: Create API keys instead of using master auth token
2. **Restrict Permissions**: Limit API key to Voice only
3. **Rotate Keys**: Change keys every 90 days
4. **Monitor Usage**: Check Twilio console for unusual activity

---

## Security Hardening

### Production Checklist

- [ ] Change `INTERNAL_API_BEARER` to secure random token
- [ ] Enable HTTPS/TLS (no plain HTTP)
- [ ] Use `wss://` for WebSocket (no `ws://`)
- [ ] Implement caller whitelist or blacklist
- [ ] Add rate limiting to prevent abuse
- [ ] Enable Twilio webhook signature validation
- [ ] Use secrets management (not plain `.env`)
- [ ] Rotate all API keys and tokens
- [ ] Set up log rotation and retention
- [ ] Configure firewall rules
- [ ] Enable CORS restrictions
- [ ] Review and sanitize error messages
- [ ] Implement monitoring and alerting
- [ ] Set up intrusion detection
- [ ] Enable Docker security scanning
- [ ] Use non-root user in Docker (already configured)

### Docker Security

Already implemented:

```dockerfile
# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs  # ← Runs as non-root
```

Additional hardening:

```dockerfile
# Add to Dockerfile
# Read-only root filesystem
RUN chmod -R 755 /app

# In deployment:
docker run --read-only --tmpfs /tmp voice-agent
```

---

## Incident Response

### Security Incident Procedures

#### 1. Token Compromise

If `INTERNAL_API_BEARER` is exposed:

```bash
# Immediate: Rotate token
NEW_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export INTERNAL_API_BEARER=$NEW_TOKEN

# Restart service
pm2 restart voice-agent

# Audit: Check logs for unauthorized access
grep -E "api/conference|api/contacts" .logs/*.log | grep "401\|403"

# Notify: Inform affected parties
```

#### 2. Twilio Credential Compromise

If Twilio auth token is exposed:

```bash
# Immediate: Rotate token in Twilio console
# 1. Go to Twilio Console → Account → API Keys
# 2. Create new Auth Token
# 3. Update environment variables
# 4. Restart service

# Audit: Check Twilio usage logs
# Look for unusual call volumes or destinations

# Notify: Contact Twilio support if fraud detected
```

#### 3. Unauthorized Access

If unauthorized API access detected:

```bash
# Investigate: Review logs
tail -f .logs/*.log | grep -E "401|403|error"

# Block: Add IP to firewall
iptables -A INPUT -s ATTACKER_IP -j DROP

# Rotate: Change all tokens/keys

# Monitor: Increase logging verbosity
```

### Security Monitoring

```bash
# Monitor failed auth attempts
tail -f .logs/*.log | jq 'select(.statusCode == 401)'

# Alert on unusual call volume
tail -f .logs/*.log | jq 'select(.event == "incoming-call")' | wc -l

# Watch for configuration changes
git diff HEAD~1 .env.example
```

---

## Security Contact

For security vulnerabilities, contact:

- **Email**: security@your-domain.com
- **PGP Key**: [Link to public key]
- **Bug Bounty**: [Link to program if applicable]

### Responsible Disclosure

We appreciate responsible disclosure:

1. Email details to security contact
2. Allow 90 days for patch development
3. Coordinate public disclosure timing

---

## Compliance

### Relevant Standards

- **PCI DSS**: If handling payment card data
- **GDPR**: If serving EU users
- **HIPAA**: If handling health information
- **TCPA**: Telephone Consumer Protection Act (US)
- **CALEA**: Communications Assistance for Law Enforcement Act (US)

### Audit Logging

All security-relevant events are logged:

```json
{
  "timestamp": "2025-11-11T20:00:00.000Z",
  "level": "info",
  "event": "auth-success",
  "endpoint": "/api/contacts",
  "method": "GET",
  "ip": "192.168.1.100",
  "userAgent": "curl/7.68.0"
}
```

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Twilio Security Best Practices](https://www.twilio.com/docs/usage/security)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

---

**Last Updated**: November 11, 2025  
**Security Review**: Required quarterly
