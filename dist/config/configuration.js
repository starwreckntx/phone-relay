"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
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
    security: {
        internalApiBearer: process.env.INTERNAL_API_BEARER,
    },
});
//# sourceMappingURL=configuration.js.map