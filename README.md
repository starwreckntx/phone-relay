# Voice-Operated Telephony Agent 📞

Production-ready Voice Telephony Agent built with NestJS, Twilio, Deepgram STT, and Abacus RouteLLM for intelligent voice command processing.

## 🌟 Features

- **Inbound Call Handling**: Accepts all incoming calls with optional DTMF input
- **Real-time Voice Processing**: Bidirectional audio streaming with Twilio Media Streams
- **Speech-to-Text**: Deepgram integration for accurate transcription
- **Intent Recognition**: Regex fast-path + LLM fallback for voice command parsing
- **3-Way Calling**: Add third participants to active conferences
- **Call Forwarding**: Transfer calls to target numbers
- **Auto-Hangup**: 20-minute timer for conference cleanup
- **Contact Management**: JSON-based contact storage with name resolution
- **Comprehensive Logging**: Structured JSON logs with full audit trail
- **Bearer Token Auth**: Secure API endpoints
- **Swagger Documentation**: Interactive API docs at `/api-docs`

## 🚀 Quick Start (< 60 minutes)

### Prerequisites

- Node.js 18+
- Yarn package manager
- Twilio account with phone number
- Deepgram API key
- ngrok (for local development)

### 1. Installation

```bash
# Clone and navigate to project
cd nodejs_space

# Install dependencies
yarn install

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your credentials:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_NUMBER=+1234567890
STT_API_KEY=your_deepgram_key
INTERNAL_API_BEARER=your-secure-token
```

### 3. Start Development Server

```bash
# Start the service
yarn start:dev
```

### 4. Expose with ngrok

```bash
# In a separate terminal
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and update `.env`:

```env
VOICE_AGENT_WS_URL=wss://abc123.ngrok.io/media-stream
PUBLIC_URL=https://abc123.ngrok.io
```

Restart the service after updating.

### 5. Configure Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Select your phone number
4. Under **Voice Configuration**:
   - **A CALL COMES IN**: Webhook → `https://abc123.ngrok.io/voice/incoming` → HTTP POST
   - **PRIMARY HANDLER FAILS**: (Optional) Add fallback URL
5. Save changes

### 6. Test the Service

Call your Twilio number and try voice commands:

- **"Add John"** - Adds contact named John to conference
- **"Call +1234567890"** - Adds phone number to conference
- **"Forward to support"** - Forwards call to support contact
- **"Hang up"** - Ends the conference

## 📱 Calling the Agent from a Website (Browser / WebRTC)

You can let website visitors talk to this agent **straight from their browser**
— no phone number required — using the Twilio Voice JavaScript SDK. The browser
call enters the exact same flow as a normal phone call (`/voice/incoming` →
greeting → conference → media stream → intents), so no changes to this service
are required. You only need to point a Twilio **TwiML App** at this agent.

The companion website implementation lives in the `hueandlogic` repo
(`app/components/phone-agent-widget.tsx` + `app/app/api/phone/token/route.ts`),
which issues a short-lived Voice access token and renders a floating
**"Call agent"** button. The feature is optional and stays hidden until the
Twilio variables below are configured.

### One-time Twilio setup

1. **Create an API Key** — Twilio Console → *Account → API keys & tokens →
   Create API key* (Standard). Note the **SID (`SK…`)** and **Secret**.
2. **Create a TwiML App** — Twilio Console → *Voice → TwiML → TwiML Apps →
   Create new*. Set the **Voice Request URL** to this agent's public endpoint:

   ```
   https://<your-agent-host>/voice/incoming      (HTTP POST)
   ```

   Note the resulting **TwiML App SID (`AP…`)**.
3. **Configure the website** with these values (see the website's
   `.env.example`):

   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_API_SECRET=your-api-key-secret
   TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> The Twilio API Secret is used only server-side (in the website's token
> endpoint) to mint short-lived tokens; it is never sent to the browser.

### Call flow

```
Browser (@twilio/voice-sdk)
  │  GET /api/phone/token   → short-lived Voice access token
  ▼
Twilio  ──(TwiML App Voice URL)──▶  this agent  /voice/incoming
  ▼
greeting → <Connect><Stream> (Deepgram STT) + <Dial><Conference> → intents
```

## 🎙️ AI Receptionist — ARC answers your calls

Instead of the conference/intent flow, you can have **ARC — the same assistant
that runs on the website — answer inbound calls** and hold a spoken
conversation with the caller (take a message, answer questions, etc.).

Point your Twilio number's (or TwiML App's) **Voice Request URL** at:

```
https://<your-agent-host>/voice/arc/incoming   (HTTP POST)
```

### How it works

This flow uses Twilio's **built-in** speech recognition (`<Gather input="speech">`)
and speech synthesis (`<Say>`), so it needs **no Deepgram or TTS keys** — the
only external call is to ARC's brain.

```
Caller ──▶ /voice/arc/incoming   (greeting, <Gather input="speech">)
       ◀── ARC speaks (<Say>)
   caller speaks ──▶ /voice/arc/reply
       │   transcript ──▶ POST ARC_CHAT_URL (/api/arc/chat)  ← same bot as the site
       ◀── <Say> ARC's reply  +  <Gather> for the next turn
   … loops until the caller says goodbye / hangs up / hits the turn cap
```

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `ARC_CHAT_URL` | ARC's public chat endpoint (the website's brain) | `https://hueandlogic.com/api/arc/chat` |
| `ARC_GREETING` | First line spoken on connect | built-in greeting |
| `ARC_VOICE` | Twilio `<Say>` voice | `Polly.Joanna` |
| `ARC_MAX_TURNS` | Safety cap on conversation length | `20` |
| `ARC_TIMEOUT_MS` | Timeout when calling ARC's brain | `15000` |

> ARC's chat endpoint must have its backend enabled (`ARC_LLM_API_KEY` set on
> the website), or `/api/arc/chat` returns `503` and the receptionist plays a
> short "not available" apology. Per-call context is kept in memory keyed by
> `CallSid`; ARC's web-style actions (navigate/open/email) are never spoken.

## 📚 API Documentation

### Swagger UI

Access interactive API documentation at: `http://localhost:3000/api-docs`

### Endpoints Overview

#### Voice Endpoints (Twilio Webhooks)

- `POST /voice/incoming` - Handle incoming calls
- `POST /voice/accept` - Accept call and start conference

#### Conference API (Bearer Auth Required)

- `POST /api/conference/add` - Add 3rd participant
- `POST /api/conference/forward` - Forward call
- `POST /api/conference/end` - End conference
- `POST /conference/events` - Status callbacks (Twilio)

#### Contact Management API (Bearer Auth Required)

- `GET /api/contacts` - Retrieve all contacts
- `PUT /api/contacts` - Update contact map

#### Health Check

- `GET /health` - Service health status

### cURL Examples

```bash
# Get all contacts
curl -X GET http://localhost:3000/api/contacts \
  -H "Authorization: Bearer your-secure-token"

# Update contacts
curl -X PUT http://localhost:3000/api/contacts \
  -H "Authorization: Bearer your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "john": "+12025551234",
    "jane": "+12025555678"
  }'

# Add participant to conference
curl -X POST http://localhost:3000/api/conference/add \
  -H "Authorization: Bearer your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "conferenceName": "conf_CA1234567890",
    "targetNumber": "+12025551234"
  }'

# Forward call
curl -X POST http://localhost:3000/api/conference/forward \
  -H "Authorization: Bearer your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "conferenceName": "conf_CA1234567890",
    "targetNumber": "+12025555678",
    "dropAgentLeg": false
  }'

# End conference
curl -X POST http://localhost:3000/api/conference/end \
  -H "Authorization: Bearer your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "conferenceName": "conf_CA1234567890"
  }'

# Health check
curl http://localhost:3000/health
```

## 🌐 Deployment Guides

### Self-host on purpbox (Docker + Tailscale Funnel) — recommended

purpbox is a private tailnet node, but **Twilio must POST call webhooks from the
public internet**. So the agent runs locally in Docker and is exposed with
**Tailscale Funnel** (public HTTPS ingress to a tailnet node).

**1. Configure** — on purpbox, in the repo:

```bash
cp .env.example .env
# Minimum for the ARC receptionist (the Twilio client boots at startup, so the
# account SID + auth token are required even for the ARC flow):
#   TWILIO_ACCOUNT_SID=AC…
#   TWILIO_AUTH_TOKEN=…
#   ARC_CHAT_URL=https://hueandlogic.com/api/arc/chat
#   INTERNAL_API_BEARER=<random string>   # protects the internal Conference/Contacts APIs
#
# Set PUBLIC_URL to the Tailscale Funnel hostname once you know it
# (the helper script prints it after step 2):
#   PUBLIC_URL=https://purpbox.<your-tailnet>.ts.net
```

**2. Run** (Docker + Tailscale Funnel):

```bash
bash scripts/start-purpbox.sh
```

This builds/starts the container and exposes it with `tailscale funnel --bg 3000`.
`--bg` keeps Funnel running after you log out and it restarts automatically with
`tailscaled`. The script prints the public HTTPS URL and the exact ARC webhook URL.

Check status:

```bash
curl -s localhost:3000/health     # {"status":"ok",...}
docker compose logs -f            # expect: "🚀 Voice Telephony Agent started on port 3000"
```

<sub>No Docker? `npm ci && npm run build && npm run start:prod` works the same way, but you still need `tailscale funnel --bg 3000` for Twilio to reach it.</sub>

**3. Point Twilio at it** — in the Twilio Console, set your number's Voice
"A call comes in" webhook (HTTP POST) to the URL the script printed, e.g.:

```
https://purpbox.<your-tailnet>.ts.net/voice/arc/incoming
```

Then set `PUBLIC_URL=https://purpbox.<your-tailnet>.ts.net` in `.env` and run
`docker compose up -d` so Twilio status callbacks use the public hostname. Call
the number — ARC answers.

**4. Keep it alive across reboots**

- The container restarts automatically (`restart: unless-stopped` in `docker-compose.yml`).
- Tailscale Funnel (`--bg`) restarts automatically with `tailscaled`.
- After a purpbox reboot, just run `bash scripts/start-purpbox.sh` again; it is
  idempotent.

**Update / stop**

```bash
# Pull changes and restart
git pull && bash scripts/start-purpbox.sh

# Stop the container (Funnel stays configured)
bash scripts/stop-purpbox.sh

# Disable the public Funnel endpoint entirely
tailscale funnel 3000 off
```

### Render.com

1. **Create Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New** → **Web Service**
   - Connect your Git repository

2. **Configure Service**
   - **Environment**: Docker
   - **Region**: Select closest to your users
   - **Instance Type**: Starter ($7/month minimum)

3. **Environment Variables**
   Add all variables from `.env.example`:
   ```
   TWILIO_ACCOUNT_SID=ACxxx...
   TWILIO_AUTH_TOKEN=xxx...
   TWILIO_NUMBER=+1234567890
   STT_API_KEY=xxx...
   INTERNAL_API_BEARER=xxx...
   NODE_ENV=production
   ```

4. **Update URLs**
   After deployment, update:
   ```
   VOICE_AGENT_WS_URL=wss://your-app.onrender.com/media-stream
   PUBLIC_URL=https://your-app.onrender.com
   ```

5. **Configure Twilio**
   Update webhook URL to: `https://your-app.onrender.com/voice/incoming`

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set secrets
fly secrets set TWILIO_ACCOUNT_SID=ACxxx...
fly secrets set TWILIO_AUTH_TOKEN=xxx...
fly secrets set TWILIO_NUMBER=+1234567890
fly secrets set STT_API_KEY=xxx...
fly secrets set INTERNAL_API_BEARER=xxx...
fly secrets set NODE_ENV=production

# Get app URL
fly info

# Update URLs in secrets
fly secrets set VOICE_AGENT_WS_URL=wss://your-app.fly.dev/media-stream
fly secrets set PUBLIC_URL=https://your-app.fly.dev

# Deploy
fly deploy
```

### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/voice-agent

# Deploy
gcloud run deploy voice-agent \
  --image gcr.io/YOUR_PROJECT_ID/voice-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "TWILIO_ACCOUNT_SID=twilio_sid:latest,TWILIO_AUTH_TOKEN=twilio_token:latest,STT_API_KEY=deepgram_key:latest,INTERNAL_API_BEARER=api_bearer:latest"

# Get service URL
gcloud run services describe voice-agent --region us-central1 --format 'value(status.url)'

# Update secrets with URLs
gcloud secrets versions add voice-agent-ws-url --data-file=- <<< "wss://your-service-xxx.run.app/media-stream"
gcloud secrets versions add public-url --data-file=- <<< "https://your-service-xxx.run.app"
```

## 🔒 Security Notes

### Bearer Token Authentication

All `/api/*` endpoints require Bearer token authentication:

```bash
Authorization: Bearer your-secure-token
```

**IMPORTANT**: Change `INTERNAL_API_BEARER` to a secure random token in production:

```bash
# Generate secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Always Accept Policy

The service accepts **all incoming calls** regardless of DTMF input. This is by design for automatic call handling. Consider:

- Using Twilio's caller ID verification
- Implementing whitelist/blacklist in production
- Adding rate limiting for abuse prevention

### Environment Variables

- Never commit `.env` to version control
- Use secrets management in production (Render Secrets, Fly Secrets, GCP Secret Manager)
- Rotate credentials regularly

## 🎛️ Configuration

### Switching STT Provider

Currently supports Deepgram (default). To add other providers:

1. Create provider interface in `src/stt/` (if needed)
2. Update `STT_PROVIDER` in `.env`
3. Implement provider-specific logic in `media-stream.gateway.ts`

### Switching TTS Provider

TTS is **optional** and defaults to OFF. To enable:

1. Set `TTS_PROVIDER=elevenlabs` or `TTS_PROVIDER=playht`
2. Add `TTS_API_KEY=your_key`
3. Implement TTS response logic in gateway

### LLM Model Configuration

The service uses Abacus RouteLLM. To change models, update the fetch call in `intents.service.ts`:

```typescript
body: JSON.stringify({
  messages: [...],
  model: 'gpt-4', // Change model here
  stream: false,
})
```

### Contact Management

Edit `contacts.json` or use the API:

```json
{
  "name": "+E164Number",
  "john": "+12025551234",
  "support": "+18005551234"
}
```

Names are case-insensitive and matched via voice commands.

## 📊 Logging

All logs are structured JSON with context:

```json
{
  "timestamp": "2025-11-11T20:00:00.000Z",
  "level": "info",
  "message": "Intent detected",
  "callSid": "CA1234567890",
  "conferenceSid": "CF9876543210",
  "intent": "add",
  "target": "+12025551234"
}
```

Key events logged:
- `incoming-call` - Call received
- `call-accepted` - Call accepted
- `conference-start` - Conference started (timer armed)
- `transcript` - STT result
- `intent` - Parsed intent
- `participant-join` / `participant-leave` - Conference changes
- `conference-end` - Conference ended

## 🧪 Testing

### Unit Tests

```bash
yarn test
```

### E2E Tests

```bash
yarn test:e2e
```

### Manual Testing

1. Call your Twilio number
2. Wait for greeting or press any key
3. Say: **"Add John"** (assumes John in contacts)
4. Verify John is added to conference
5. Say: **"Hang up"**
6. Verify conference ends

Check logs for detailed event flow.

## 🐛 Troubleshooting

### WebSocket Connection Issues

- Verify `VOICE_AGENT_WS_URL` uses `wss://` for HTTPS deployments
- Check ngrok/deployment exposes WebSocket properly
- Ensure firewall allows WebSocket connections

### Transcription Not Working

- Verify `STT_API_KEY` is correct
- Check Deepgram account has credits
- Review logs for Deepgram errors

### Intent Not Recognized

- Check transcript in logs
- Verify contact exists in `contacts.json`
- Test with explicit phone numbers first
- Check LLM API key and endpoint

### Conference Not Starting

- Verify Twilio webhooks are configured correctly
- Check `PUBLIC_URL` is accessible from internet
- Review Twilio debugger for webhook errors

### 20-Minute Timer Not Working

- Check logs for `conference-start` event
- Verify timer is armed (should see in logs)
- Test with shorter timeout for debugging

## 📝 Architecture

```
┌─────────────┐
│   Caller    │
└──────┬──────┘
       │ Dials Twilio Number
       ▼
┌─────────────────────────────────────┐
│          Twilio Voice API           │
│  POST /voice/incoming (TwiML)       │
│  POST /voice/accept (TwiML)         │
└──────────┬──────────────────────────┘
           │ TwiML Starts Media Stream + Conference
           ▼
┌─────────────────────────────────────┐
│     NestJS Voice Agent Service      │
│                                     │
│  ┌────────────────────────────┐    │
│  │  WebSocket Gateway         │    │
│  │  /media-stream             │    │
│  └───────┬────────────────────┘    │
│          │                          │
│          ├─► Deepgram STT           │
│          │   (Live Transcription)   │
│          │                          │
│          ├─► Intent Parser           │
│          │   (Regex + LLM)          │
│          │                          │
│          └─► Conference Service     │
│              (Add/Forward/End)      │
│                                     │
│  ┌────────────────────────────┐    │
│  │  Conference Events         │    │
│  │  POST /conference/events   │    │
│  │  (20-min timer)            │    │
│  └────────────────────────────┘    │
│                                     │
│  ┌────────────────────────────┐    │
│  │  Contact Manager           │    │
│  │  contacts.json             │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: This README
- **Swagger**: `http://localhost:3000/api-docs`
- **Logs**: Structured JSON logs for debugging
- **Issues**: Report bugs via GitHub Issues

## 🎯 Roadmap

- [ ] Redis-based session storage
- [ ] PostgreSQL contact storage
- [ ] Multiple TTS provider support
- [ ] Call recording functionality
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Voicemail integration

---

Built with ❤️ using NestJS, Twilio, Deepgram, and Abacus AI
