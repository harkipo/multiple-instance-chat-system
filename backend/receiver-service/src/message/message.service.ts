import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { CreateMessageInput } from './dto/create-message.input';
import { MessageReadStatus } from './dto/message-read-status.dto';
import { ChatService } from '../chat/chat.service';
import { pubSub } from '../common/redis-pubsub.provider';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    private chatService: ChatService,
  ) {}


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

  async getMessageReadStatus(messageId: string): Promise<MessageReadStatus> {
    const message = await this.findOne(messageId);
    const chat = await this.chatService.findOne(message.chatId);

    // Get all participants except the sender
    const otherParticipants = chat.participantIds.filter(id => id !== message.senderId);
    const totalParticipants = otherParticipants.length;

    // Get read receipts for this message
    const reads = await this.messageReadRepository.find({
      where: { messageId },
    });

    const readByCount = reads.length;
    const isFullyRead = readByCount >= totalParticipants;

    const readByUsers = reads.map(read => ({
      userId: read.userId,
      readAt: read.readAt,
    }));

    return {
      messageId,
      totalParticipants,
      readByCount,
      isFullyRead,
      readByUsers,
    };
  }

  getPubSub() {
    return pubSub;
  }
}
