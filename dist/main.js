"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_ws_1 = require("@nestjs/platform-ws");
const app_module_1 = require("./app.module");
const logger_service_1 = require("./common/logger/logger.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    const logger = app.get(logger_service_1.LoggerService);
    app.useLogger(logger);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const isDev = process.env.NODE_ENV === 'development';
    app.enableCors({
        origin: isDev ? ['http://localhost:3000', 'http://localhost:*'] : false,
        credentials: true,
    });
    app.useWebSocketAdapter(new platform_ws_1.WsAdapter(app));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Voice-Operated Telephony Agent API')
        .setDescription('Production-ready Voice Telephony Agent with Twilio, Deepgram STT, and Abacus RouteLLM')
        .setVersion('1.0.0')
        .addBearerAuth()
        .addTag('voice', 'Voice call handling endpoints')
        .addTag('conference', 'Conference management endpoints')
        .addTag('contacts', 'Contact management endpoints')
        .addTag('health', 'Health check endpoints')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api-docs', app, document);
    app.enableShutdownHooks();
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`🚀 Voice Telephony Agent started on port ${port}`, {
        event: 'startup',
        port,
        env: process.env.NODE_ENV,
        swagger: `http://localhost:${port}/api-docs`,
    });
}
bootstrap();
//# sourceMappingURL=main.js.map