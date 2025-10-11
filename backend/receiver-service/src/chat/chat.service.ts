import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './entities/chat.entity';
import { CreateChatInput } from './dto/create-chat.input';
import { pubSub } from '../common/redis-pubsub.provider';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
  ) {}


  async findAll(): Promise<Chat[]> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('chat.messages', 'messages')
      .orderBy('chat.updatedAt', 'DESC')
      .addOrderBy('messages.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id, isActive: true },
      relations: ['messages'],
    });

    if (!chat) {
      throw new NotFoundException(`Chat with ID ${id} not found`);
    }

    return chat;
  }

  async findByParticipant(userId: string): Promise<Chat[]> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.isActive = :isActive', { isActive: true })
      .andWhere('chat.participantIds @> :userId', { userId: JSON.stringify(userId) })
      .leftJoinAndSelect('chat.messages', 'messages')
      .orderBy('chat.updatedAt', 'DESC')
      .addOrderBy('messages.createdAt', 'DESC')
      .getMany();
  }


  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.findOne(chatId);
    return chat.participantIds.includes(userId);
  }


  getPubSub() {
    return pubSub;
  }
}
