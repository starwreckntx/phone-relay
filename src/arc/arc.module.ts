import { Module } from '@nestjs/common';
import { ArcService } from './arc.service';
import { ArcVoiceController } from './arc-voice.controller';

/**
 * AI receptionist module — ARC answers inbound calls. LoggerService comes from
 * the global CommonModule and ConfigService from the global ConfigModule.
 */
@Module({
  controllers: [ArcVoiceController],
  providers: [ArcService],
})
export class ArcModule {}
