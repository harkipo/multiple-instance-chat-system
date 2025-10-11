import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { CreateMessageInput } from './dto/create-message.input';
import { ChatService } from '../chat/chat.service';
import { UnreadCountService } from '../chat/unread-count.service';
import { pubSub } from '../common/redis-pubsub.provider';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    private chatService: ChatService,
    private unreadCountService: UnreadCountService,
  ) {}

  async create(createMessageInput: CreateMessageInput): Promise<Message> {
    // Verify user is participant in the chat
    const isParticipant = await this.chatService.isParticipant(
      createMessageInput.chatId,
      createMessageInput.senderId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant in this chat');
    }

    const message = this.messageRepository.create(createMessageInput);
    const savedMessage = await this.messageRepository.save(message);

    // Publish message to subscribers
    await pubSub.publish('messageAdded', {
      messageAdded: savedMessage,
    });

    // Also publish a notification to all chat participants
    // This helps ensure that users who haven't seen the chat yet get notified
    await pubSub.publish('chatMessageNotification', {
      chatMessageNotification: {
        chatId: createMessageInput.chatId,
        message: savedMessage,
        senderId: createMessageInput.senderId,
      },
    });

    // Publish a general message update notification for chat list updates
    await pubSub.publish('messageUpdateForChatList', {
      messageUpdateForChatList: {
        chatId: createMessageInput.chatId,
        message: savedMessage,
        senderId: createMessageInput.senderId,
      },
    });

    // Increment unread count for all participants except the sender
    const chat = await this.chatService.findOne(createMessageInput.chatId);
    const otherParticipants = chat.participantIds.filter(id => id !== createMessageInput.senderId);
    
    for (const participantId of otherParticipants) {
      await this.unreadCountService.incrementUnreadCount(createMessageInput.chatId, participantId);
    }

    return savedMessage;
  }

  async findAll(chatId: string): Promise<Message[]> {
    // Verify chat exists
    await this.chatService.findOne(chatId);

    return this.messageRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: ['chat'],
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }

  async update(id: string, content: string, userId: string): Promise<Message> {
    const message = await this.findOne(id);

    // Verify user is the sender
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();

    const updatedMessage = await this.messageRepository.save(message);

    // Publish updated message to subscribers
    await pubSub.publish('messageUpdated', {
      messageUpdated: updatedMessage,
    });

    return updatedMessage;
  }

  async remove(id: string, userId: string): Promise<Message> {
    const message = await this.findOne(id);

    // Verify user is the sender
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete this message');
    }

    await this.messageRepository.remove(message);

    // Publish message deletion to subscribers
    await pubSub.publish('messageDeleted', {
      messageDeleted: { id: message.id, chatId: message.chatId },
    });

    return message;
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<MessageRead> {
    // Verify message exists
    const message = await this.findOne(messageId);

    // Check if user is a participant in the chat
    const isParticipant = await this.chatService.isParticipant(message.chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant in this chat');
    }

    // Check if already marked as read
    const existingRead = await this.messageReadRepository.findOne({
      where: { messageId, userId },
    });

    if (existingRead) {
      return existingRead;
    }

    // Create new read receipt
    const messageRead = this.messageReadRepository.create({ messageId, userId });
    const savedRead = await this.messageReadRepository.save(messageRead);

    // Check if this is the first time this user has read a message in this chat
    // If so, reset the unread count for this chat
    const chat = await this.chatService.findOne(message.chatId);
    const unreadCount = await this.unreadCountService.getUnreadCount(message.chatId, userId);
    
    if (unreadCount > 0) {
      await this.unreadCountService.resetUnreadCount(message.chatId, userId);
    }

    // Publish read receipt update
    await pubSub.publish('messageReadUpdated', {
      messageReadUpdated: {
        messageId,
        userId,
        readAt: savedRead.readAt,
      },
    });

    return savedRead;
  }
}
