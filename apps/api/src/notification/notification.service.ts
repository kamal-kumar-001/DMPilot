import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: string, id: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  /** Stable source event key: retries create one item, not one per delivery. */
  async notifyOnce(
    userId: string,
    eventKey: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
  ) {
    const id = createHash('sha256').update(`${userId}:${eventKey}`).digest('hex');
    try {
      return await this.prisma.notification.upsert({
        where: { id },
        update: {},
        create: { id, userId, title, message, type },
      });
    } catch {
      // An optional bell update must not break billing, auth or message handling.
      return null;
    }
  }
}
