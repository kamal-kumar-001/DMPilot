import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { ScheduledPublishExecutor } from './scheduled-publish.processor';
import { ConfigService } from '../config/config.service';

/**
 * BullMQ worker entry for the repeatable scheduled-publish sweep.
 *
 * DEFAULT OFF, enforced at execution time: a repeat job registered earlier,
 * or a job queued by any other path, must not run while the operator gate is
 * off. The bootstrap registration check alone is not sufficient because
 * repeatable jobs persist in Redis across restarts and redeploys.
 */
@Processor(QUEUE_NAMES.SCHEDULED_PUBLISH)
export class ScheduledPublishWorker extends WorkerHost {
  constructor(
    private readonly executor: ScheduledPublishExecutor,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    if (this.config.get('SCHEDULED_PUBLISH_ENABLED') !== 'true') {
      // Complete the job without work; never touch SCHEDULED rows while OFF.
      return;
    }
    await this.executor.publishDueScheduledPosts();
  }
}
