# Shadow Agent — owner's private voice agent

Summoned by calling the same Twilio number that runs ARC. Owner gets Shadow;
everyone else still gets the ARC receptionist.

## How routing works

```
Inbound call → POST /voice/arc/incoming
                 │
                 ├─ From == SHADOW_OWNER_NUMBER (and SHADOW_ENABLED=true)
                 │    → <Redirect> /voice/shadow/incoming  → Shadow answers
                 │
                 └─ anyone else → ARC receptionist (unchanged)
```

You can also point a Twilio Voice Request URL directly at
`POST /voice/shadow/incoming` if you'd rather give Shadow its own number.

## The loop

Identical mechanics to ARC — Twilio's `<Gather input="speech">` for STT and
`<Say>` for TTS, so no Deepgram/TTS keys are involved. Per turn, phone-relay
POSTs the conversation (system prompt + history, keyed by `CallSid`) to
`SHADOW_CHAT_URL`, any OpenAI-compatible chat endpoint. Default brain is the
purpbox Kimi shim:

```
SHADOW_CHAT_URL=https://purpbox.tail902902.ts.net/v1/chat/completions
SHADOW_MODEL=kimi-for-coding
```

Shadow has its own system prompt (`SHADOW_SYSTEM_PROMPT`) and keeps full
in-call memory (up to `SHADOW_MAX_TURNS`, default 40). It executes no actions
— it's a conversational agent, not a receptionist.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `SHADOW_ENABLED` | `false` | Master switch for owner auto-route |
| `SHADOW_OWNER_NUMBER` | — | Your cell, E.164 (e.g. `+12545612078`) |
| `SHADOW_CHAT_URL` | purpbox shim `/v1/chat/completions` | Any OpenAI-compatible endpoint |
| `SHADOW_API_KEY` | — | Sent as `Authorization: Bearer` — set it to the shim's token |
| `SHADOW_MODEL` | `kimi-for-coding` | Model id the brain expects |
| `SHADOW_SYSTEM_PROMPT` | built-in Shadow persona | Override to reshape behavior |
| `SHADOW_GREETING` | "Shadow's here. What are we working on?" | |
| `SHADOW_VOICE` | `Google.en-US-Studio-O` | Any Twilio `<Say>` voice |
| `SHADOW_MAX_TURNS` | `40` | Per-call turn cap |
| `SHADOW_TIMEOUT_MS` | `20000` | Brain call timeout |

## Deploy checklist (purpbox)

1. Merge this branch, `git pull` in the phone-relay clone, rebuild/restart
   the container.
2. Add to `.env`:
   ```
   SHADOW_ENABLED=true
   SHADOW_OWNER_NUMBER=+1xxxxxxxxxx
   SHADOW_API_KEY=<shim bearer token>
   ```
3. Restart the service. No Twilio webhook change needed — the webhook stays on
   `/voice/arc/incoming` and the owner-gate redirects internally.
4. Call (743) 256-1787 from your cell → Shadow greets you. Call from any other
   number → ARC answers as before.

## Security notes

- Owner match is caller-ID based; caller ID is spoofable. Shadow executes no
  actions, so worst case a spoofer chats with your LLM — but if you later give
  Shadow capabilities, add a DTMF PIN challenge on entry.
- If `SHADOW_CHAT_URL` points at the funnel-exposed shim, make sure the shim
  enforces the bearer token (`SHADOW_API_KEY`), otherwise anyone with the
  hostname can spend your Kimi quota.
