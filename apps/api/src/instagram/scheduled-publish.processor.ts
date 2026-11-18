import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ContentPublishService } from './content-publish.service';
import { QUEUE_NAMES } from '../queue/constants';

const SWEEP_JOB = 'publish-due-scheduled-posts';
const SWEEP_INTERVAL_MS = 60_000;
// A claimed row (PUBLISHING) this old means the executor died mid-run.
// Reclaiming could double-publish, so stale claims are never retried
// automatically: they are marked FAILED with an explicit verify-first note.
const STALE_CLAIM_MS = 15 * 60_000;

/**
 * Drives SCHEDULED postPublish rows to Meta when their time comes. The sweep
 * is a BullMQ repeatable job, so no external scheduler/cron is required: any
 * running API instance keeps it alive. Claiming is atomic (status-conditional
 * updateMany), so multiple instances cannot execute the same post twice.
 */
@Injectable()
export class ScheduledPublishExecutor implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduledPublishExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentPublish: ContentPublishService,
    @Optional() @InjectQueue(QUEUE_NAMES.SCHEDULED_PUBLISH) private readonly queue?: Queue,
  ) {}

  async onApplicationBootstrap() {
    if (!this.queue) return;
    await this.queue.add(
      SWEEP_JOB,
      {},
      {
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log(`Scheduled-publish sweep registered (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  }

  /** One sweep. Exposed for direct testing without Redis. */
  async publishDueScheduledPosts(now = new Date()): Promise<{ claimed: number; stale: number }> {
    // Reclaim nothing: stale PUBLISHING rows are marked FAILED with an
    // unknown-outcome note rather than republished blindly.
    const stale = await this.prisma.postPublish.updateMany({
      where: {
        status: 'PUBLISHING',
        updatedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) },
        scheduledAt: { not: null },
      },
      data: {
        status: 'FAILED',
        errorMessage:
          'Publishing outcome unknown: the executor was interrupted mid-run. Check Instagram before scheduling this post again.',
      },
    });

    const due = await this.prisma.postPublish.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    let claimed = 0;
    for (const row of due) {
      // Atomic claim: only the instance that flips SCHEDULED -> PUBLISHING runs it.
      const claim = await this.prisma.postPublish.updateMany({
        where: { id: row.id, status: 'SCHEDULED' },
        data: { status: 'PUBLISHING' },
      });
      if (claim.count !== 1) continue;
      claimed++;
      try {
        await this.contentPublish.executeScheduledPost(row.id);
      } catch (err: any) {
        // executeScheduledPost already records FAILED; this guards unexpected throws.
        this.logger.error(`Scheduled post [${row.id}] execution error: ${err?.message}`);
      }
    }
    return { claimed, stale: stale.count };
  }
}
