
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { CommonModule } from './common/common.module';
import { VoiceModule } from './voice/voice.module';
import { ConferenceModule } from './conference/conference.module';
import { ContactsModule } from './contacts/contacts.module';
import { IntentsModule } from './intents/intents.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CommonModule,
    VoiceModule,
    ConferenceModule,
    ContactsModule,
    IntentsModule,
    WebsocketModule,
    HealthModule,
  ],
})
export class AppModule {}
