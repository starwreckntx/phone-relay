import { Module } from '@nestjs/common';
import { ShadowService } from './shadow.service';
import { ShadowVoiceController } from './shadow-voice.controller';

/**
 * Shadow agent module — the owner's private voice agent. LoggerService comes
 * from the global CommonModule and ConfigService from the global ConfigModule.
 */
@Module({
  controllers: [ShadowVoiceController],
  providers: [ShadowService],
})
export class ShadowModule {}
