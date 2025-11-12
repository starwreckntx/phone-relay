
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import type { ContactMap } from './contacts.service';
import { BearerAuthGuard } from '../common/guards/bearer-auth.guard';

@ApiTags('contacts')
@Controller('api/contacts')
@UseGuards(BearerAuthGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiResponse({ status: 200, description: 'Contact map returned successfully' })
  getAllContacts(): ContactMap {
    return this.contactsService.getAllContacts();
  }

  @Put()
  @ApiOperation({ summary: 'Update contact map' })
  @ApiResponse({ status: 200, description: 'Contacts updated successfully' })
  updateContacts(@Body() contacts: ContactMap): ContactMap {
    return this.contactsService.updateContacts(contacts);
  }
}
