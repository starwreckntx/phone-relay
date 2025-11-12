
import { Module } from '@nestjs/common';
import { IntentsService } from './intents.service';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [ContactsModule],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
