import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { CreateChatInput } from './dto/create-chat.input';

@Resolver(() => Chat)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}


  @Mutation(() => Chat)
  async createChat(@Args('createChatInput') createChatInput: CreateChatInput): Promise<Chat> {
    return this.chatService.create(createChatInput);
  }

  @Mutation(() => Chat)
  async addParticipant(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('userId') userId: string,
  ): Promise<Chat> {
    return this.chatService.addParticipant(chatId, userId);
  }

  @Mutation(() => Chat)
  async addParticipants(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('userIds', { type: () => [String] }) userIds: string[],
  ): Promise<Chat> {
    return this.chatService.addParticipants(chatId, userIds);
  }

  @Mutation(() => Chat)
  async removeParticipant(
    @Args('chatId', { type: () => ID }) chatId: string,
    @Args('userId') userId: string,
  ): Promise<Chat> {
    return this.chatService.removeParticipant(chatId, userId);
  }

  @Mutation(() => Chat)
  async removeChat(@Args('id', { type: () => ID }) id: string): Promise<Chat> {
    return this.chatService.remove(id);
  }
}
