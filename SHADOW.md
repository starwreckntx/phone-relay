# Shadow Agent — the owner's private voice agent

Summoned by calling the same Twilio number that runs ARC. The owner gets Shadow;
everyone else still gets the ARC receptionist.

## How routing works

```
Inbound call → POST /voice/arc/incoming
                 │
                 ├─ From matches SHADOW_OWNER_NUMBER (last 10 digits) and SHADOW_ENABLED=true
                 │    → <Redirect> /voice/shadow/incoming
                 │        ├─ SHADOW_PIN set → key the PIN → /voice/shadow/verify → Shadow answers
                 │        └─ no PIN → Shadow answers
                 │
                 └─ anyone else → ARC receptionist (unchanged)
```

You can also point a Twilio Voice Request URL directly at
`POST /voice/shadow/incoming` if you'd rather give Shadow its own number.

## The loop

Identical mechanics to ARC — Twilio's `<Gather input="speech">` for STT and
`<Say>` for TTS, so no Deepgram/TTS keys are involved. Per turn, phone-relay
POSTs the conversation (system prompt + last ~24 turns, keyed by `CallSid`) to
`SHADOW_CHAT_URL`, any OpenAI-compatible chat endpoint. Default brain is the
purpbox Kimi shim:

```
SHADOW_CHAT_URL=https://purpbox.tail902902.ts.net/v1/chat/completions
SHADOW_MODEL=kimi-for-coding
```

Shadow has its own system prompt (`SHADOW_SYSTEM_PROMPT`) and keeps full
in-call memory (up to `SHADOW_MAX_TURNS`, default 40). The system turn is always
preserved in the request window, so the persona holds even on long calls. Shadow
executes no actions — it's a conversational agent, not a receptionist.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `SHADOW_ENABLED` | `false` | Master switch for the owner auto-route |
| `SHADOW_OWNER_NUMBER` | — | Your cell, E.164 (e.g. `+12545612078`); matched on last 10 digits |
| `SHADOW_PIN` | — | Optional DTMF second factor; recommended (caller ID is spoofable) |
| `SHADOW_CHAT_URL` | purpbox shim `/v1/chat/completions` | Any OpenAI-compatible endpoint |
| `SHADOW_API_KEY` | — | Sent as `Authorization: Bearer` — set it to the shim's token |
| `SHADOW_MODEL` | `kimi-for-coding` | Model id the brain expects |
| `SHADOW_SYSTEM_PROMPT` | built-in Shadow persona | Override to reshape behavior |
| `SHADOW_GREETING` | "Shadow's here. What are we working on?" | |
| `SHADOW_VOICE` | `Google.en-US-Studio-O` | Any Twilio `<Say>` voice |
| `SHADOW_MAX_TURNS` | `40` | Per-call turn cap |
| `SHADOW_TIMEOUT_MS` | `20000` | Brain call timeout |

## Deploy checklist (purpbox)

1. `git pull` in the phone-relay clone, rebuild/restart the container.
2. Add to `.env`:
   ```
   SHADOW_ENABLED=true
   SHADOW_OWNER_NUMBER=+1xxxxxxxxxx
   SHADOW_PIN=1234              # optional but recommended
   SHADOW_API_KEY=<shim bearer token>
   ```
3. Restart the service. No Twilio webhook change needed — the webhook stays on
   `/voice/arc/incoming` and the owner-gate redirects internally.
4. Call your number from your cell → key the PIN (if set) → Shadow greets you.
   Call from any other number → ARC answers as before.

## Security notes

- **Two factors.** The owner match is caller-ID based, and caller ID is
  spoofable — so `SHADOW_PIN` adds a DTMF second factor at entry. Set it. Even
  with a spoofed number, a caller without the PIN is hung up on. (Shadow also
  executes no actions, so blast radius is low regardless.)
- **Match tightness.** Owner matching compares the last 10 digits and requires a
  full 10-digit owner number, so a blank/short value can't over-match callers.
- **Shim auth.** If `SHADOW_CHAT_URL` points at the funnel-exposed shim, make
  sure the shim enforces the bearer token (`SHADOW_API_KEY`), otherwise anyone
  with the hostname can spend your Kimi quota.
