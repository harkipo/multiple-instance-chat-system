import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { UnreadCountService } from './unread-count.service';
import { Chat } from './entities/chat.entity';
import { UnreadCount } from './entities/unread-count.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, UnreadCount])],
  providers: [ChatService, ChatResolver, UnreadCountService],
  exports: [ChatService, UnreadCountService],
})
export class ChatModule {}
