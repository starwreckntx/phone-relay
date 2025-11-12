
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configure CORS
  const isDev = process.env.NODE_ENV === 'development';
  app.enableCors({
    origin: isDev ? ['http://localhost:3000', 'http://localhost:*'] : false,
    credentials: true,
  });

  // Setup WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Voice-Operated Telephony Agent API')
    .setDescription(
      'Production-ready Voice Telephony Agent with Twilio, Deepgram STT, and Abacus RouteLLM',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('voice', 'Voice call handling endpoints')
    .addTag('conference', 'Conference management endpoints')
    .addTag('contacts', 'Contact management endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Graceful shutdown
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
