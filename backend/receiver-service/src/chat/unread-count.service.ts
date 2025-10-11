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

  getPubSub() {
    return pubSub;
  }
}
