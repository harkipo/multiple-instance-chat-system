import { Resolver, Query, Args, ID, Subscription } from '@nestjs/graphql';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';

@Resolver(() => Chat)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Query(() => [Chat], { name: 'chats' })
  async findAll(): Promise<Chat[]> {
    return this.chatService.findAll();
  }

  @Query(() => Chat, { name: 'chat' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Chat> {
    return this.chatService.findOne(id);
  }

  @Query(() => [Chat], { name: 'chatsByParticipant' })
  async findByParticipant(@Args('userId') userId: string): Promise<Chat[]> {
    return this.chatService.findByParticipant(userId);
  }

  @Subscription(() => Chat, {
    filter: (payload, variables) => {
      return payload.chatAdded.participantIds.includes(variables.userId);
    },
  })
  async chatAdded(@Args('userId') userId: string) {
    return this.chatService.getPubSub().asyncIterator('chatAdded');
  }

  @Subscription(() => Chat, {
    filter: (payload, variables) => {
      return payload.chatUpdated.participantIds.includes(variables.userId);
    },
  })
  async chatUpdated(@Args('userId') userId: string) {
    return this.chatService.getPubSub().asyncIterator('chatUpdated');
  }
}
