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

  async create(createChatInput: CreateChatInput): Promise<Chat> {
    const chat = this.chatRepository.create(createChatInput);
    const savedChat = await this.chatRepository.save(chat);
    
    // Publish chat creation to all participants
    await pubSub.publish('chatAdded', {
      chatAdded: savedChat,
    });

    return savedChat;
  }

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

  async addParticipant(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.findOne(chatId);
    
    if (!chat.participantIds.includes(userId)) {
      chat.participantIds.push(userId);
      return this.chatRepository.save(chat);
    }
    
    return chat;
  }

  async addParticipants(chatId: string, userIds: string[]): Promise<Chat> {
    const chat = await this.findOne(chatId);
    
    const newParticipants = userIds.filter(userId => !chat.participantIds.includes(userId));
    if (newParticipants.length > 0) {
      chat.participantIds.push(...newParticipants);
      const savedChat = await this.chatRepository.save(chat);
      
      // Publish chat update to all participants
      await pubSub.publish('chatUpdated', {
        chatUpdated: savedChat,
      });
      
      return savedChat;
    }
    
    return chat;
  }

  async removeParticipant(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.findOne(chatId);
    
    chat.participantIds = chat.participantIds.filter(id => id !== userId);
    return this.chatRepository.save(chat);
  }

  async remove(chatId: string): Promise<Chat> {
    const chat = await this.findOne(chatId);
    chat.isActive = false;
    return this.chatRepository.save(chat);
  }

  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.findOne(chatId);
    return chat.participantIds.includes(userId);
  }
}
