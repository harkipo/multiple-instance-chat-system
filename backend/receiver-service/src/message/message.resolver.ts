import { Resolver, Query, Args, ID, Subscription } from '@nestjs/graphql';
import { MessageService } from './message.service';
import { Message } from './entities/message.entity';
import { MessageReadStatus } from './dto/message-read-status.dto';
import { MessageReadUpdate } from './dto/message-read-update.dto';

@Resolver(() => Message)
export class MessageResolver {
  constructor(private readonly messageService: MessageService) {}

  @Query(() => [Message], { name: 'messages' })
  async findAll(@Args('chatId', { type: () => ID }) chatId: string): Promise<Message[]> {
    return this.messageService.findAll(chatId);
  }

  @Query(() => Message, { name: 'message' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Message> {
    return this.messageService.findOne(id);
  }

  @Query(() => MessageReadStatus, { name: 'messageReadStatus' })
  async getMessageReadStatus(@Args('messageId', { type: () => ID }) messageId: string): Promise<MessageReadStatus> {
    return this.messageService.getMessageReadStatus(messageId);
  }

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      return payload.messageAdded.chatId === variables.chatId;
    },
  })
  async messageAdded(@Args('chatId', { type: () => ID }) chatId: string) {
    return this.messageService.getPubSub().asyncIterator('messageAdded');
  }

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      return payload.messageUpdated.chatId === variables.chatId;
    },
  })
  async messageUpdated(@Args('chatId', { type: () => ID }) chatId: string) {
    return this.messageService.getPubSub().asyncIterator('messageUpdated');
  }

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      return payload.messageDeleted.chatId === variables.chatId;
    },
  })
  async messageDeleted(@Args('chatId', { type: () => ID }) chatId: string) {
    return this.messageService.getPubSub().asyncIterator('messageDeleted');
  }

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      // Notify all participants of the chat except the sender
      return payload.chatMessageNotification.senderId !== variables.userId;
    },
  })
  async chatMessageNotification(@Args('userId') userId: string) {
    return this.messageService.getPubSub().asyncIterator('chatMessageNotification');
  }

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      // Notify all users about message updates for chat list refresh
      // This ensures chat lists are updated when messages are sent
      return payload.messageUpdateForChatList.senderId !== variables.userId;
    },
  })
  async messageUpdateForChatList(@Args('userId') userId: string) {
    return this.messageService.getPubSub().asyncIterator('messageUpdateForChatList');
  }

  @Subscription(() => MessageReadUpdate, {
    filter: (payload, variables) => {
      return payload.messageReadUpdated.messageId === variables.messageId;
    },
  })
  async messageReadUpdated(@Args('messageId', { type: () => ID }) messageId: string) {
    return this.messageService.getPubSub().asyncIterator('messageReadUpdated');
  }
}
