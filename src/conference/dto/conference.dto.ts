
import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipantDto {
  @ApiProperty({ description: 'Conference name' })
  @IsString()
  conferenceName: string;

  @ApiProperty({ description: 'Target phone number in E.164 format' })
  @IsString()
  targetNumber: string;

  @ApiProperty({ description: 'From phone number', required: false })
  @IsString()
  @IsOptional()
  fromNumber?: string;
}

export class ForwardCallDto {
  @ApiProperty({ description: 'Conference name' })
  @IsString()
  conferenceName: string;

  @ApiProperty({ description: 'Target phone number in E.164 format' })
  @IsString()
  targetNumber: string;

  @ApiProperty({ description: 'Whether to drop agent leg after forwarding', default: false })
  @IsBoolean()
  @IsOptional()
  dropAgentLeg?: boolean;

  @ApiProperty({ description: 'From phone number', required: false })
  @IsString()
  @IsOptional()
  fromNumber?: string;
}

export class EndConferenceDto {
  @ApiProperty({ description: 'Conference name' })
  @IsString()
  conferenceName: string;
}
