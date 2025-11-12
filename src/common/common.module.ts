
import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';
import { BearerAuthGuard } from './guards/bearer-auth.guard';

@Global()
@Module({
  providers: [LoggerService, BearerAuthGuard],
  exports: [LoggerService, BearerAuthGuard],
})
export class CommonModule {}
