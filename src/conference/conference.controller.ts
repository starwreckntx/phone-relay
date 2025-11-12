
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ConferenceService } from './conference.service';
import { BearerAuthGuard } from '../common/guards/bearer-auth.guard';
import { LoggerService } from '../common/logger/logger.service';
import {
  AddParticipantDto,
  ForwardCallDto,
  EndConferenceDto,
} from './dto/conference.dto';

@ApiTags('conference')
@Controller()
export class ConferenceController {
  constructor(
    private readonly conferenceService: ConferenceService,
    private readonly logger: LoggerService,
  ) {}

  @Post('conference/events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio conference status callbacks' })
  @ApiResponse({ status: 200, description: 'Event processed successfully' })
  async handleConferenceEvents(@Body() body: any): Promise<void> {
    const {
      ConferenceSid,
      FriendlyName,
      StatusCallbackEvent,
      CallSid,
      ParticipantLabel,
    } = body;

    this.logger.log('Conference event received', {
      conferenceSid: ConferenceSid,
      conferenceName: FriendlyName,
      event: StatusCallbackEvent,
      callSid: CallSid,
    });

    switch (StatusCallbackEvent) {
      case 'conference-start':
        this.conferenceService.handleConferenceStart(ConferenceSid, FriendlyName);
        break;
      case 'conference-end':
        this.conferenceService.handleConferenceEnd(ConferenceSid);
        break;
      case 'participant-join':
        this.conferenceService.handleParticipantJoin(
          ConferenceSid,
          CallSid,
          ParticipantLabel,
        );
        break;
      case 'participant-leave':
        this.conferenceService.handleParticipantLeave(ConferenceSid, CallSid);
        break;
    }
  }

  @Post('api/conference/add')
  @UseGuards(BearerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add third participant to conference (3-way calling)' })
  @ApiResponse({ status: 200, description: 'Participant added successfully' })
  async addParticipant(@Body() dto: AddParticipantDto) {
    return this.conferenceService.addParticipant(
      dto.conferenceName,
      dto.targetNumber,
      dto.fromNumber,
    );
  }

  @Post('api/conference/forward')
  @UseGuards(BearerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Forward call to target number' })
  @ApiResponse({ status: 200, description: 'Call forwarded successfully' })
  async forwardCall(@Body() dto: ForwardCallDto) {
    return this.conferenceService.forwardCall(
      dto.conferenceName,
      dto.targetNumber,
      dto.dropAgentLeg,
      dto.fromNumber,
    );
  }

  @Post('api/conference/end')
  @UseGuards(BearerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End conference immediately' })
  @ApiResponse({ status: 200, description: 'Conference ended successfully' })
  async endConference(@Body() dto: EndConferenceDto) {
    return this.conferenceService.endConference(dto.conferenceName);
  }
}
