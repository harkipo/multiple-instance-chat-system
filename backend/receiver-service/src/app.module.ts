import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { MessageModule } from './message/message.module';
import { HealthModule } from './health/health.module';
import { DateTimeScalar } from './common/datetime.scalar';
import { Chat } from './chat/entities/chat.entity';
import { UnreadCount } from './chat/entities/unread-count.entity';
import { Message } from './message/entities/message.entity';
import { MessageRead } from './message/entities/message-read.entity';

@Module({
  imports: [
    // Database configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'chat_system',
      entities: [Chat, UnreadCount, Message, MessageRead],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    
    // GraphQL configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
    }),
    
    ChatModule,
    MessageModule,
    HealthModule,
  ],
  providers: [DateTimeScalar],
})
export class AppModule {}
