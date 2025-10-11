import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { MessageService } from './message.service';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { CreateMessageInput } from './dto/create-message.input';

@Resolver(() => Message)
export class MessageResolver {
  constructor(private readonly messageService: MessageService) {}


  @Mutation(() => Message)
  async createMessage(@Args('createMessageInput') createMessageInput: CreateMessageInput): Promise<Message> {
    return this.messageService.create(createMessageInput);
  }

  @Mutation(() => Message)
  async updateMessage(
    @Args('id', { type: () => ID }) id: string,
    @Args('content') content: string,
    @Args('userId') userId: string,
  ): Promise<Message> {
    return this.messageService.update(id, content, userId);
  }

  @Mutation(() => Message)
  async removeMessage(
    @Args('id', { type: () => ID }) id: string,
    @Args('userId') userId: string,
  ): Promise<Message> {
    return this.messageService.remove(id, userId);
  }

  @Mutation(() => MessageRead)
  async markMessageAsRead(
    @Args('messageId', { type: () => ID }) messageId: string,
    @Args('userId') userId: string,
  ): Promise<MessageRead> {
    return this.messageService.markMessageAsRead(messageId, userId);
  }
}
