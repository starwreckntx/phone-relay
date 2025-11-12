
import { Module } from '@nestjs/common';
import { MediaStreamGateway } from './media-stream.gateway';
import { IntentsModule } from '../intents/intents.module';
import { ConferenceModule } from '../conference/conference.module';

@Module({
  imports: [IntentsModule, ConferenceModule],
  providers: [MediaStreamGateway],
})
export class WebsocketModule {}
