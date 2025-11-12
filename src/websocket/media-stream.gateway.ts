
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { IntentsService } from '../intents/intents.service';
import { ConferenceService } from '../conference/conference.service';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

interface StreamMetadata {
  callSid: string;
  conferenceName: string;
  caller: string;
}

@WebSocketGateway({ path: '/media-stream' })
export class MediaStreamGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly deepgramApiKey: string;
  private readonly sessions = new Map<any, StreamMetadata>();
  private readonly deepgramConnections = new Map<any, any>();

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private intentsService: IntentsService,
    private conferenceService: ConferenceService,
  ) {
    this.deepgramApiKey = this.configService.get<string>('stt.apiKey') || '';
  }

  handleConnection(client: any, request: any) {
    this.logger.log('WebSocket client connected', {
      event: 'ws-connection',
    });

    client.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(client, data);
      } catch (error) {
        this.logger.error('Error handling WS message', error.message, {
          error,
        });
      }
    });

    client.on('error', (error: Error) => {
      this.logger.error('WebSocket client error', error.message, { error });
    });
  }

  handleDisconnect(client: any) {
    const metadata = this.sessions.get(client);
    this.logger.log('WebSocket client disconnected', {
      callSid: metadata?.callSid,
      event: 'ws-disconnect',
    });

    // Clean up Deepgram connection
    const deepgram = this.deepgramConnections.get(client);
    if (deepgram) {
      try {
        deepgram.finish();
      } catch (error) {
        this.logger.error('Error closing Deepgram connection', error.message);
      }
      this.deepgramConnections.delete(client);
    }

    this.sessions.delete(client);
  }

  private async handleMessage(client: any, data: any) {
    const { event } = data;

    switch (event) {
      case 'start':
        await this.handleStart(client, data);
        break;
      case 'media':
        await this.handleMedia(client, data);
        break;
      case 'stop':
        this.handleStop(client, data);
        break;
      default:
        this.logger.debug('Unknown event type', { event });
    }
  }

  private async handleStart(client: any, data: any) {
    const { start, streamSid, callSid, customParameters } = data;
    
    const metadata: StreamMetadata = {
      callSid: callSid || customParameters?.callSid,
      conferenceName: customParameters?.conferenceName,
      caller: customParameters?.caller,
    };

    this.sessions.set(client, metadata);

    this.logger.log('Media stream started', {
      streamSid,
      callSid: metadata.callSid,
      conferenceName: metadata.conferenceName,
      event: 'stream-start',
    });

    // Initialize Deepgram connection
    await this.initializeDeepgram(client, metadata);
  }

  private async initializeDeepgram(client: any, metadata: StreamMetadata) {
    try {
      const deepgram = createClient(this.deepgramApiKey);

      const connection = deepgram.listen.live({
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
        model: 'nova-2',
        smart_format: true,
        interim_results: true,
      });

      connection.on(LiveTranscriptionEvents.Open, () => {
        this.logger.debug('Deepgram connection opened', {
          callSid: metadata.callSid,
        });
      });

      connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;

        if (transcript && isFinal) {
          this.logger.log('Transcript received', {
            callSid: metadata.callSid,
            transcript,
            event: 'transcript',
          });

          // Parse intent from transcript
          const intent = await this.intentsService.parseIntent(
            transcript,
            metadata.callSid,
          );

          if (intent.intent !== 'none') {
            this.logger.log('Intent detected', {
              callSid: metadata.callSid,
              intent: intent.intent,
              target: intent.target_number || intent.target_name,
            });

            // Execute intent
            await this.executeIntent(intent, metadata);
          }
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        this.logger.error('Deepgram error', error.message, {
          callSid: metadata.callSid,
          error,
        });
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        this.logger.debug('Deepgram connection closed', {
          callSid: metadata.callSid,
        });
      });

      this.deepgramConnections.set(client, connection);
    } catch (error) {
      this.logger.error('Failed to initialize Deepgram', error.message, {
        callSid: metadata.callSid,
        error,
      });
    }
  }

  private async handleMedia(client: any, data: any) {
    const deepgram = this.deepgramConnections.get(client);
    if (!deepgram) {
      return;
    }

    const { media } = data;
    if (media && media.payload) {
      try {
        // Convert base64 audio to buffer and send to Deepgram
        const audioBuffer = Buffer.from(media.payload, 'base64');
        deepgram.send(audioBuffer);
      } catch (error) {
        const metadata = this.sessions.get(client);
        this.logger.error('Error sending audio to Deepgram', error.message, {
          callSid: metadata?.callSid,
          error,
        });
      }
    }
  }

  private handleStop(client: any, data: any) {
    const metadata = this.sessions.get(client);
    this.logger.log('Media stream stopped', {
      callSid: metadata?.callSid,
      event: 'stream-stop',
    });

    const deepgram = this.deepgramConnections.get(client);
    if (deepgram) {
      try {
        deepgram.finish();
      } catch (error) {
        this.logger.error('Error finishing Deepgram', error.message);
      }
      this.deepgramConnections.delete(client);
    }
  }

  private async executeIntent(intent: any, metadata: StreamMetadata) {
    const { conferenceName } = metadata;

    switch (intent.intent) {
      case 'add':
        if (intent.target_number) {
          await this.conferenceService.addParticipant(
            conferenceName,
            intent.target_number,
          );
        } else {
          this.logger.warn('Add intent without target number', {
            callSid: metadata.callSid,
            intent,
          });
        }
        break;

      case 'forward':
        if (intent.target_number) {
          await this.conferenceService.forwardCall(
            conferenceName,
            intent.target_number,
            false,
          );
        } else {
          this.logger.warn('Forward intent without target number', {
            callSid: metadata.callSid,
            intent,
          });
        }
        break;

      case 'end':
        await this.conferenceService.endConference(conferenceName);
        break;

      default:
        this.logger.debug('Unhandled intent', {
          callSid: metadata.callSid,
          intent: intent.intent,
        });
    }
  }
}
