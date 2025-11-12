declare const _default: () => {
    port: number;
    nodeEnv: string;
    twilio: {
        accountSid: string | undefined;
        authToken: string | undefined;
        phoneNumber: string | undefined;
    };
    voiceAgent: {
        wsUrl: string;
    };
    stt: {
        provider: string;
        apiKey: string | undefined;
    };
    tts: {
        provider: string;
        apiKey: string | undefined;
    };
    llm: {
        apiKey: string | undefined;
        endpoint: string;
    };
    security: {
        internalApiBearer: string | undefined;
    };
};
export default _default;
