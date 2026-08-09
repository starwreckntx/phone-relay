
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
    greeting:
      process.env.ARC_GREETING ||
      "Hi, you've reached Hue and Logic. I'm ARC, the studio's assistant. How can I help you today?",
    voice: process.env.ARC_VOICE || 'Polly.Joanna',
    maxTurns: parseInt(process.env.ARC_MAX_TURNS || '20', 10),
    timeoutMs: parseInt(process.env.ARC_TIMEOUT_MS || '15000', 10),
  },
  security: {
    internalApiBearer: process.env.INTERNAL_API_BEARER,
  },
});
