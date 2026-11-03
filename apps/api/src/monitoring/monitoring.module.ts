import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { QUEUE_NAMES } from '../queue/constants';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH },
      { name: QUEUE_NAMES.SEND_DM },
    ),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
