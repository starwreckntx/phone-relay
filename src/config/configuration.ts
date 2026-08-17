
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_NUMBER,
  },
  voiceAgent: {
    wsUrl: process.env.VOICE_AGENT_WS_URL || 'ws://localhost:3000/media-stream',
  },
  stt: {
    provider: process.env.STT_PROVIDER || 'deepgram',
    apiKey: process.env.STT_API_KEY,
  },
  tts: {
    provider: process.env.TTS_PROVIDER || 'none',
    apiKey: process.env.TTS_API_KEY,
  },
  llm: {
    apiKey: process.env.ABACUSAI_API_KEY,
    endpoint: 'https://apps.abacus.ai/v1/chat/completions',
  },
  // AI receptionist: ARC (the website assistant) answers inbound calls via
  // /voice/arc/incoming. chatUrl points at ARC's public brain endpoint.
  arc: {
    chatUrl: process.env.ARC_CHAT_URL || 'https://hueandlogic.com/api/arc/chat',
    // Where a captured brief is delivered when ARC emits an `email` action
    // (the site's Resend-backed contact endpoint).
    briefUrl: process.env.ARC_BRIEF_URL || 'https://hueandlogic.com/api/contact',
    greeting:
      process.env.ARC_GREETING ||
      "Hi, you've reached Hue and Logic. I'm ARC, the studio's assistant. How can I help you today?",
    voice: process.env.ARC_VOICE || 'Google.en-US-Studio-O',
    maxTurns: parseInt(process.env.ARC_MAX_TURNS || '20', 10),
    timeoutMs: parseInt(process.env.ARC_TIMEOUT_MS || '15000', 10),
  },
  // Shadow agent: the owner's private voice agent, summoned by calling the
  // number. When enabled and ownerNumber matches the caller, ARC's incoming
  // webhook redirects to /voice/shadow/incoming — one number, two agents.
  // chatUrl is any OpenAI-compatible endpoint; the purpbox Kimi shim is the
  // default brain. An optional DTMF pin gates entry (caller ID is spoofable).
  shadow: {
    enabled: (process.env.SHADOW_ENABLED || 'false').toLowerCase() === 'true',
    ownerNumber: process.env.SHADOW_OWNER_NUMBER || '', // E.164, e.g. +12545612078
    pin: process.env.SHADOW_PIN || '', // optional DTMF second factor
    chatUrl:
      process.env.SHADOW_CHAT_URL ||
      'https://purpbox.tail902902.ts.net/v1/chat/completions',
    apiKey: process.env.SHADOW_API_KEY || '',
    model: process.env.SHADOW_MODEL || 'kimi-for-coding',
    systemPrompt: process.env.SHADOW_SYSTEM_PROMPT || '',
    greeting:
      process.env.SHADOW_GREETING || "Shadow's here. What are we working on?",
    voice: process.env.SHADOW_VOICE || 'Google.en-US-Studio-O',
    maxTurns: parseInt(process.env.SHADOW_MAX_TURNS || '40', 10),
    timeoutMs: parseInt(process.env.SHADOW_TIMEOUT_MS || '20000', 10),
  },
  security: {
    internalApiBearer: process.env.INTERNAL_API_BEARER,
  },
});
