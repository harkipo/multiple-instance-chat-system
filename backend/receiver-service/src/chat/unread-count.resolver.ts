import { Resolver, Query, Args, ID, Subscription } from '@nestjs/graphql';
import { UnreadCountService } from './unread-count.service';
import { UnreadCount } from './entities/unread-count.entity';
import { UnreadCountUpdate } from './dto/unread-count-update.dto';

@Resolver(() => UnreadCount)
export class UnreadCountResolver {
  constructor(private readonly unreadCountService: UnreadCountService) {}

  @Query(() => [UnreadCount], { name: 'unreadCounts' })
  async getUnreadCountsForUser(@Args('userId') userId: string): Promise<UnreadCount[]> {
    return this.unreadCountService.getUnreadCountsForUser(userId);
  }

  @Query(() => Number, { name: 'unreadCount' })
  async getUnreadCount(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('userId') userId: string,
  ): Promise<number> {
    return this.unreadCountService.getUnreadCount(chatId, userId);
  }

  @Subscription(() => UnreadCountUpdate, {
    filter: (payload, variables) => {
      return payload.unreadCountUpdated.userId === variables.userId;
    },
  })
  async unreadCountUpdated(@Args('userId') userId: string) {
    return this.unreadCountService.getPubSub().asyncIterator('unreadCountUpdated');
  }
}
