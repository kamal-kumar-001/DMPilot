import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { ScheduledPublishExecutor } from './scheduled-publish.processor';

/** BullMQ worker entry for the repeatable scheduled-publish sweep. */
@Processor(QUEUE_NAMES.SCHEDULED_PUBLISH)
export class ScheduledPublishWorker extends WorkerHost {
  constructor(private readonly executor: ScheduledPublishExecutor) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.executor.publishDueScheduledPosts();
  }
}
