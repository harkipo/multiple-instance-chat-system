import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { UserService } from '../../backend/user-service/src/user/user.service';
import { User } from '../../backend/user-service/src/user/entities/user.entity';
import { Chat } from '../../backend/sender-service/src/chat/entities/chat.entity';
import { Message } from '../../backend/sender-service/src/message/entities/message.entity';
import { MessageRead } from '../../backend/sender-service/src/message/entities/message-read.entity';
import { UnreadCount } from '../../backend/sender-service/src/chat/entities/unread-count.entity';

describe('Chat Flow E2E Tests', () => {
  let userApp: INestApplication;
  let senderApp: INestApplication;
  let receiverApp: INestApplication;

  beforeAll(async () => {
    // Create User Service module
    const userModule: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
    }).compile();

    // Create Sender Service module
    const senderModule: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Chat, Message, MessageRead, UnreadCount],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Chat, Message, MessageRead, UnreadCount]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
    }).compile();

    // Create Receiver Service module
    const receiverModule: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Chat, Message, MessageRead, UnreadCount],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Chat, Message, MessageRead, UnreadCount]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          subscriptions: {
            'graphql-ws': true,
          },
        }),
      ],
    }).compile();

    userApp = userModule.createNestApplication();
    senderApp = senderModule.createNestApplication();
    receiverApp = receiverModule.createNestApplication();

    await userApp.init();
    await senderApp.init();
    await receiverApp.init();
  });

  afterAll(async () => {
    await userApp.close();
    await senderApp.close();
    await receiverApp.close();
  });

  describe('Complete Chat Flow', () => {
    it('should create users, chat, send messages, and handle read receipts', async () => {
      // Step 1: Create users via User Service
      const createUserMutation = `
        mutation CreateUser($username: String!, $email: String!, $displayName: String!) {
          createUser(username: $username, email: $email, displayName: $displayName) {
            id
            username
            email
            displayName
          }
        }
      `;

      const user1Response = await request(userApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createUserMutation,
          variables: {
            username: 'alice',
            email: 'alice@example.com',
            displayName: 'Alice',
          },
        });

      const user2Response = await request(userApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createUserMutation,
          variables: {
            username: 'bob',
            email: 'bob@example.com',
            displayName: 'Bob',
          },
        });

      const user1 = user1Response.body.data.createUser;
      const user2 = user2Response.body.data.createUser;

      expect(user1.username).toBe('alice');
      expect(user2.username).toBe('bob');

      // Step 2: Create chat via Sender Service
      const createChatMutation = `
        mutation CreateChat($createChatInput: CreateChatInput!) {
          createChat(createChatInput: $createChatInput) {
            id
            name
            chatType
            participantIds
          }
        }
      `;

      const chatResponse = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createChatMutation,
          variables: {
            createChatInput: {
              name: 'Alice & Bob Chat',
              description: 'Private conversation',
              chatType: 'direct',
              participantIds: [user1.id, user2.id],
            },
          },
        });

      const chat = chatResponse.body.data.createChat;
      expect(chat.participantIds).toContain(user1.id);
      expect(chat.participantIds).toContain(user2.id);

      // Step 3: Send messages via Sender Service
      const createMessageMutation = `
        mutation CreateMessage($createMessageInput: CreateMessageInput!) {
          createMessage(createMessageInput: $createMessageInput) {
            id
            content
            senderId
            chatId
            createdAt
          }
        }
      `;

      const message1Response = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createMessageMutation,
          variables: {
            createMessageInput: {
              content: 'Hello Bob!',
              senderId: user1.id,
              chatId: chat.id,
            },
          },
        });

      const message1 = message1Response.body.data.createMessage;
      expect(message1.content).toBe('Hello Bob!');

      // Step 4: Query messages via Receiver Service
      const getMessagesQuery = `
        query GetMessages($chatId: ID!) {
          messages(chatId: $chatId) {
            id
            content
            senderId
            chatId
            createdAt
          }
        }
      `;

      const messagesResponse = await request(receiverApp.getHttpServer())
        .post('/graphql')
        .send({
          query: getMessagesQuery,
          variables: { chatId: chat.id },
        });

      const messages = messagesResponse.body.data.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello Bob!');

      // Step 5: Mark message as read via Sender Service
      const markAsReadMutation = `
        mutation MarkMessageAsRead($messageId: ID!, $userId: String!) {
          markMessageAsRead(messageId: $messageId, userId: $userId) {
            messageId
            userId
            readAt
          }
        }
      `;

      const readResponse = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: markAsReadMutation,
          variables: {
            messageId: message1.id,
            userId: user2.id,
          },
        });

      const messageRead = readResponse.body.data.markMessageAsRead;
      expect(messageRead.messageId).toBe(message1.id);
      expect(messageRead.userId).toBe(user2.id);

      // Step 6: Check unread counts via Receiver Service
      const getUnreadCountsQuery = `
        query GetUnreadCounts($userId: String!) {
          unreadCounts(userId: $userId) {
            chatId
            userId
            unreadCount
          }
        }
      `;

      const unreadResponse = await request(receiverApp.getHttpServer())
        .post('/graphql')
        .send({
          query: getUnreadCountsQuery,
          variables: { userId: user2.id },
        });

      const unreadCounts = unreadResponse.body.data.unreadCounts;
      const chatUnread = unreadCounts.find((uc: any) => uc.chatId === chat.id);
      
      // After marking as read, count should be 0
      expect(chatUnread?.unreadCount || 0).toBe(0);
    });
  });

  describe('Multi-Instance Support', () => {
    it('should handle operations across different service instances', async () => {
      // Test that sender service mutations work
      const createChatMutation = `
        mutation CreateChat($createChatInput: CreateChatInput!) {
          createChat(createChatInput: $createChatInput) {
            id
            name
          }
        }
      `;

      const chatResponse = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createChatMutation,
          variables: {
            createChatInput: {
              name: 'Test Chat',
              description: 'Multi-instance test',
              chatType: 'group',
              participantIds: ['user1', 'user2'],
            },
          },
        });

      const chat = chatResponse.body.data.createChat;
      expect(chat.name).toBe('Test Chat');

      // Test that receiver service queries work
      const getChatsQuery = `
        query GetChats {
          chats {
            id
            name
          }
        }
      `;

      const chatsResponse = await request(receiverApp.getHttpServer())
        .post('/graphql')
        .send({ query: getChatsQuery });

      const chats = chatsResponse.body.data.chats;
      expect(chats.length).toBeGreaterThan(0);
    });
  });

  describe('Read Receipts and Unread Indicators', () => {
    it('should track unread message counts correctly', async () => {
      // Create users
      const user1 = { id: 'test-user-1', username: 'user1' };
      const user2 = { id: 'test-user-2', username: 'user2' };

      // Create chat
      const createChatMutation = `
        mutation CreateChat($createChatInput: CreateChatInput!) {
          createChat(createChatInput: $createChatInput) {
            id
            name
            participantIds
          }
        }
      `;

      const chatResponse = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createChatMutation,
          variables: {
            createChatInput: {
              name: 'Unread Test Chat',
              chatType: 'direct',
              participantIds: [user1.id, user2.id],
            },
          },
        });

      const chat = chatResponse.body.data.createChat;

      // Send message
      const createMessageMutation = `
        mutation CreateMessage($createMessageInput: CreateMessageInput!) {
          createMessage(createMessageInput: $createMessageInput) {
            id
            content
          }
        }
      `;

      const messageResponse = await request(senderApp.getHttpServer())
        .post('/graphql')
        .send({
          query: createMessageMutation,
          variables: {
            createMessageInput: {
              content: 'Test unread message',
              senderId: user1.id,
              chatId: chat.id,
            },
          },
        });

      const message = messageResponse.body.data.createMessage;

      // Check unread count for user2
      const getUnreadCountQuery = `
        query GetUnreadCount($chatId: ID!, $userId: String!) {
          unreadCount(chatId: $chatId, userId: $userId)
        }
      `;

      const unreadResponse = await request(receiverApp.getHttpServer())
        .post('/graphql')
        .send({
          query: getUnreadCountQuery,
          variables: {
            chatId: chat.id,
            userId: user2.id,
          },
        });

      const unreadCount = unreadResponse.body.data.unreadCount;
      expect(unreadCount).toBeGreaterThan(0);
    });
  });
});
