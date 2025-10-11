import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnreadCount } from './entities/unread-count.entity';
import { pubSub } from '../common/redis-pubsub.provider';

@Injectable()
export class UnreadCountService {
  constructor(
    @InjectRepository(UnreadCount)
    private unreadCountRepository: Repository<UnreadCount>,
  ) {}

  async incrementUnreadCount(chatId: string, userId: string): Promise<UnreadCount> {
    let unreadCount = await this.unreadCountRepository.findOne({
      where: { chatId, userId },
    });

    if (!unreadCount) {
      unreadCount = this.unreadCountRepository.create({
        chatId,
        userId,
        unreadCount: 1,
      });
    } else {
      unreadCount.unreadCount += 1;
    }

    const savedUnreadCount = await this.unreadCountRepository.save(unreadCount);

    // Publish unread count update
    await pubSub.publish('unreadCountUpdated', {
      unreadCountUpdated: {
        chatId,
        userId,
        unreadCount: savedUnreadCount.unreadCount,
      },
    });

    return savedUnreadCount;
  }

  async resetUnreadCount(chatId: string, userId: string): Promise<UnreadCount> {
    let unreadCount = await this.unreadCountRepository.findOne({
      where: { chatId, userId },
    });

    if (!unreadCount) {
      unreadCount = this.unreadCountRepository.create({
        chatId,
        userId,
        unreadCount: 0,
      });
    } else {
      unreadCount.unreadCount = 0;
    }

    const savedUnreadCount = await this.unreadCountRepository.save(unreadCount);

    // Publish unread count update
    await pubSub.publish('unreadCountUpdated', {
      unreadCountUpdated: {
        chatId,
        userId,
        unreadCount: savedUnreadCount.unreadCount,
      },
    });

    return savedUnreadCount;
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const unreadCount = await this.unreadCountRepository.findOne({
      where: { chatId, userId },
    });

    return unreadCount?.unreadCount || 0;
  }

  async getUnreadCountsForUser(userId: string): Promise<UnreadCount[]> {
    return this.unreadCountRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }
}
