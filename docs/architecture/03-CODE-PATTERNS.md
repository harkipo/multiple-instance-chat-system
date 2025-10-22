# Code Patterns Analysis

## 🎯 Overview

This document analyzes every design pattern used in the codebase, explaining why each pattern was chosen and how it's implemented. Each pattern serves a specific purpose in creating a maintainable, scalable, and type-safe system.

## 🔧 Dependency Injection Pattern

### Why Dependency Injection?

**Primary Reasons**:
1. **Testability**: Easy to mock dependencies for unit tests
2. **Flexibility**: Can swap implementations without changing client code
3. **Loose coupling**: Classes don't create their own dependencies
4. **Configuration**: Centralized dependency configuration
5. **Lifecycle management**: Framework handles object creation and destruction

### NestJS Implementation

**How NestJS Implements DI**:
```typescript
// 1. Service with dependencies
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private chatService: ChatService,
    private pubSub: PubSub
  ) {}
}

// 2. Module configuration
@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  providers: [MessageService, ChatService, PubSub],
  exports: [MessageService],
})
export class MessageModule {}

// 3. Automatic injection
@Resolver(() => Message)
export class MessageResolver {
  constructor(private messageService: MessageService) {}
  // messageService is automatically injected
}
```

### Benefits in Our System

#### 1. **Easy Testing**
```typescript
// Unit test with mocked dependencies
describe('MessageService', () => {
  let service: MessageService;
  let mockRepository: Repository<Message>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });
});
```

#### 2. **Configuration Flexibility**
```typescript
// Different implementations for different environments
@Module({
  providers: [
    {
      provide: 'PUBSUB',
      useFactory: (configService: ConfigService) => {
        if (configService.get('NODE_ENV') === 'test') {
          return new InMemoryPubSub();
        }
        return new RedisPubSub(configService.get('REDIS_URL'));
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

### File References
- **Implementation**: `backend/*/src/*/services/*.service.ts`
- **Configuration**: `backend/*/src/app.module.ts`
- **Usage**: `backend/*/src/*/resolvers/*.resolver.ts`

## 🗄️ Repository Pattern

### Why Repository Pattern?

**Primary Reasons**:
1. **Data access abstraction**: Hides database implementation details
2. **Testability**: Easy to mock data access layer
3. **Consistency**: Standardized data access methods
4. **Flexibility**: Can change data storage without affecting business logic
5. **Query encapsulation**: Complex queries encapsulated in repository methods

### TypeORM Implementation

**How TypeORM Implements Repository Pattern**:
```typescript
// 1. Entity definition
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @Column()
  senderId: string;

  @Column()
  chatId: string;
}

// 2. Repository injection
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>
  ) {}

  // 3. Repository usage
  async findAll(chatId: string): Promise<Message[]> {
    return this.messageRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
    });
  }
}
```

### Benefits for Testing

#### 1. **Mock Repository**
```typescript
// Test with mocked repository
const mockRepository = {
  find: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MessageService,
      {
        provide: getRepositoryToken(Message),
        useValue: mockRepository,
      },
    ],
  }).compile();
});
```

#### 2. **Query Builder Usage**
```typescript
// Complex queries encapsulated
async findByParticipant(userId: string): Promise<Message[]> {
  return this.messageRepository
    .createQueryBuilder('message')
    .leftJoinAndSelect('message.chat', 'chat')
    .where('chat.participantIds @> :userId', { 
      userId: JSON.stringify(userId) 
    })
    .orderBy('message.createdAt', 'DESC')
    .getMany();
}
```

### Active Record vs Data Mapper

**Our Choice**: Data Mapper (Repository pattern)

**Benefits**:
- Better separation of concerns
- Easier testing with mocks
- More flexible
- Cleaner service layer

**Implementation**:
```typescript
// Data Mapper - Service uses repository
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>
  ) {}

  async create(data: CreateMessageInput): Promise<Message> {
    const message = this.messageRepository.create(data);
    return this.messageRepository.save(message);
  }
}
```

### File References
- **Entities**: `backend/*/src/*/entities/*.entity.ts`
- **Services**: `backend/*/src/*/services/*.service.ts`
- **Repository usage**: Throughout service implementations

## 🔍 Resolver Pattern

### Why GraphQL Resolvers?

**Primary Reasons**:
1. **Field-level resolution**: Each field can have custom logic
2. **Type safety**: Strong typing between schema and implementation
3. **Composition**: Resolvers can be composed and reused
4. **Performance**: Can optimize individual field resolution
5. **Flexibility**: Can add computed fields and relationships

### GraphQL Resolver Implementation

**Basic Resolver Structure**:
```typescript
@Resolver(() => Message)
export class MessageResolver {
  constructor(private readonly messageService: MessageService) {}

  @Query(() => [Message], { name: 'messages' })
  async findAll(@Args('chatId', { type: () => ID }) chatId: string): Promise<Message[]> {
    return this.messageService.findAll(chatId);
  }

  @Mutation(() => Message)
  async createMessage(@Args('createMessageInput') createMessageInput: CreateMessageInput): Promise<Message> {
    return this.messageService.create(createMessageInput);
  }
}
```

### Field Resolvers vs Root Resolvers

#### Root Resolvers (Our Primary Use)
```typescript
// Root query resolver
@Query(() => [Message])
async messages(@Args('chatId') chatId: string): Promise<Message[]> {
  return this.messageService.findAll(chatId);
}

// Root mutation resolver
@Mutation(() => Message)
async createMessage(@Args('input') input: CreateMessageInput): Promise<Message> {
  return this.messageService.create(input);
}
```

#### Field Resolvers (For Computed Fields)
```typescript
// Field resolver for computed data
@ResolveField(() => Boolean)
async isReadByAll(@Parent() message: Message): Promise<boolean> {
  return this.messageService.isReadByAll(message.id);
}

@ResolveField(() => [User])
async participants(@Parent() chat: Chat): Promise<User[]> {
  return this.userService.findByIds(chat.participantIds);
}
```

### Subscription Resolvers

**Real-time Subscription Implementation**:
```typescript
@Subscription(() => Message, {
  filter: (payload, variables) => {
    return payload.messageAdded.chatId === variables.chatId;
  },
})
async messageAdded(@Args('chatId', { type: () => ID }) chatId: string) {
  return this.messageService.getPubSub().asyncIterator('messageAdded');
}
```

### Benefits in Our System

#### 1. **Type Safety**
```typescript
// Automatic type generation
interface CreateMessageInput {
  content: string;
  senderId: string;
  chatId: string;
}

// Type-safe resolver
@Mutation(() => Message)
async createMessage(@Args('createMessageInput') input: CreateMessageInput): Promise<Message> {
  // input is fully typed
  return this.messageService.create(input);
}
```

#### 2. **Validation Integration**
```typescript
// Automatic validation with class-validator
@InputType()
export class CreateMessageInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @Field()
  @IsUUID()
  senderId: string;
}
```

### File References
- **Resolvers**: `backend/*/src/*/resolvers/*.resolver.ts`
- **DTOs**: `backend/*/src/*/dto/*.input.ts`
- **Entities**: `backend/*/src/*/entities/*.entity.ts`

## 📡 PubSub Pattern

### Why PubSub Pattern?

**Primary Reasons**:
1. **Decoupling**: Publishers don't know about subscribers
2. **Scalability**: Easy to add new subscribers
3. **Real-time**: Enables real-time communication
4. **Event-driven**: Supports event-driven architecture
5. **Cross-instance**: Enables multi-instance communication

### Redis PubSub Implementation

**Publisher Implementation**:
```typescript
// Publish events from Sender Service
@Injectable()
export class MessageService {
  constructor(
    private pubSub: PubSub,
    // ... other dependencies
  ) {}

  async create(createMessageInput: CreateMessageInput): Promise<Message> {
    const message = await this.messageRepository.save(messageData);

    // Publish to multiple channels
    await pubSub.publish('messageAdded', { messageAdded: message });
    await pubSub.publish('chatMessageNotification', { 
      chatMessageNotification: { chatId, message, senderId } 
    });
    await pubSub.publish('messageUpdateForChatList', { 
      messageUpdateForChatList: { chatId, message, senderId } 
    });

    return message;
  }
}
```

**Subscriber Implementation**:
```typescript
// Subscribe to events in Receiver Service
@Resolver(() => Message)
export class MessageResolver {
  @Subscription(() => Message)
  async messageAdded(@Args('chatId') chatId: string) {
    return this.messageService.getPubSub().asyncIterator('messageAdded');
  }

  @Subscription(() => Message)
  async chatMessageNotification(@Args('userId') userId: string) {
    return this.messageService.getPubSub().asyncIterator('chatMessageNotification');
  }
}
```

### Channel Design Strategy

**Multiple Channels for Different Purposes**:
```typescript
// 1. Direct message updates
'messageAdded' // New message in specific chat
'messageUpdated' // Message edited
'messageDeleted' // Message removed

// 2. User-specific notifications
'chatMessageNotification' // Notify user of new messages
'unreadCountUpdated' // Update unread counts

// 3. Chat list updates
'messageUpdateForChatList' // Update chat previews
'chatAdded' // New chat created
'chatUpdated' // Chat modified

// 4. Read receipts
'messageReadUpdated' // Read status changed
```

### Event Filtering

**Subscription Filtering**:
```typescript
@Subscription(() => Message, {
  filter: (payload, variables) => {
    // Only send to users in the same chat
    return payload.messageAdded.chatId === variables.chatId;
  },
})
async messageAdded(@Args('chatId') chatId: string) {
  return this.pubSub.asyncIterator('messageAdded');
}

@Subscription(() => Message, {
  filter: (payload, variables) => {
    // Don't send to the sender
    return payload.chatMessageNotification.senderId !== variables.userId;
  },
})
async chatMessageNotification(@Args('userId') userId: string) {
  return this.pubSub.asyncIterator('chatMessageNotification');
}
```

### File References
- **Publisher**: `backend/sender-service/src/common/redis-pubsub.provider.ts`
- **Subscriber**: `backend/receiver-service/src/common/redis-pubsub.provider.ts`
- **Usage**: Throughout message and chat services

## 🎨 Custom Scalar Pattern

### Why Custom Scalars?

**Primary Reasons**:
1. **Type safety**: Ensure correct data types
2. **Serialization**: Handle data transformation
3. **Validation**: Validate data at schema level
4. **Consistency**: Standardize data formats
5. **GraphQL integration**: Work seamlessly with GraphQL

### DateTime Scalar Implementation

**Custom Scalar Definition**:
```typescript
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type';

  serialize(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  parseValue(value: string): Date {
    return new Date(value);
  }

  parseLiteral(ast: any): Date {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  }
}
```

### Why DateTime Scalar Was Needed

#### 1. **GraphQL Date Handling**
```typescript
// Without custom scalar - GraphQL doesn't have built-in Date type
@Field()
createdAt: string; // Loses type information

// With custom scalar - Type-safe Date handling
@Field(() => Date)
createdAt: Date; // Full type safety
```

#### 2. **Consistent Serialization**
```typescript
// Ensures all dates are ISO strings
serialize(value: any): string {
  if (value instanceof Date) {
    return value.toISOString(); // Always ISO format
  }
  // Handle other formats
}
```

#### 3. **Validation at Schema Level**
```typescript
// Invalid dates are caught at GraphQL level
parseValue(value: string): Date {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date;
}
```

### File References
- **Implementation**: `backend/*/src/common/datetime.scalar.ts`
- **Usage**: In all entity definitions with Date fields

## ✅ Input DTOs Pattern

### Why Input DTOs?

**Primary Reasons**:
1. **Validation**: Centralized input validation
2. **Type safety**: Strong typing for inputs
3. **Documentation**: Self-documenting API
4. **Transformation**: Data transformation before processing
5. **Security**: Input sanitization and validation

### Class-validator Implementation

**DTO Definition with Validation**:
```typescript
@InputType()
export class CreateMessageInput {
  @Field()
  @IsNotEmpty({ message: 'Content cannot be empty' })
  @IsString()
  @MaxLength(5000, { message: 'Message too long' })
  content: string;

  @Field()
  @IsNotEmpty()
  @IsUUID(4, { message: 'Invalid sender ID format' })
  senderId: string;

  @Field()
  @IsNotEmpty()
  @IsUUID(4, { message: 'Invalid chat ID format' })
  chatId: string;
}
```

### Why class-validator vs Alternatives

#### 1. **class-validator vs Joi**

**class-validator Benefits**:
- Decorator-based (consistent with NestJS)
- TypeScript-first
- Integrates well with GraphQL
- Automatic validation in resolvers

**Joi Benefits**:
- More mature
- Better error messages
- More validation rules
- Language agnostic

**Why class-validator**: Better integration with NestJS and TypeScript ecosystem.

#### 2. **class-validator vs Yup**

**class-validator Benefits**:
- Decorator-based
- Better GraphQL integration
- Less boilerplate

**Yup Benefits**:
- More flexible
- Better error handling
- More validation features

**Why class-validator**: Simpler integration with our decorator-based architecture.

### Validation in Resolvers

**Automatic Validation**:
```typescript
@Mutation(() => Message)
async createMessage(@Args('createMessageInput') createMessageInput: CreateMessageInput): Promise<Message> {
  // Validation happens automatically before this method is called
  // If validation fails, GraphQL returns validation errors
  return this.messageService.create(createMessageInput);
}
```

### File References
- **DTOs**: `backend/*/src/*/dto/*.input.ts`
- **Usage**: In all mutation resolvers

## 🏗️ Entity Decorators Pattern

### Why Entity Decorators?

**Primary Reasons**:
1. **Declarative**: Clear entity definition
2. **Type safety**: Database schema matches TypeScript types
3. **Migrations**: Automatic migration generation
4. **Relationships**: Easy relationship definition
5. **Validation**: Database-level constraints

### TypeORM Decorators Implementation

**Entity Definition**:
```typescript
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'chat_id' })
  chatId: string;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Chat, chat => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @OneToMany(() => MessageRead, read => read.message)
  reads: MessageRead[];
}
```

### Decorator Benefits

#### 1. **Automatic Schema Generation**
```typescript
// Decorators generate this SQL
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  sender_id VARCHAR(255) NOT NULL,
  chat_id UUID NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. **Relationship Management**
```typescript
// One-to-many relationship
@OneToMany(() => MessageRead, read => read.message)
reads: MessageRead[];

// Many-to-one relationship
@ManyToOne(() => Chat, chat => chat.messages)
@JoinColumn({ name: 'chat_id' })
chat: Chat;
```

#### 3. **Column Customization**
```typescript
// Custom column mapping
@Column({ name: 'sender_id', type: 'varchar', length: 255 })
senderId: string;

// JSONB column
@Column({ type: 'jsonb' })
participantIds: string[];

// Timestamp with default
@CreateDateColumn({ name: 'created_at' })
createdAt: Date;
```

### File References
- **Entities**: `backend/*/src/*/entities/*.entity.ts`
- **Schema**: Generated in `init-db.sql`

## 🏢 Service Layer Pattern

### Why Service Layer?

**Primary Reasons**:
1. **Business logic separation**: Keep business logic out of resolvers
2. **Reusability**: Services can be used by multiple resolvers
3. **Testability**: Easy to unit test business logic
4. **Transaction management**: Handle complex operations
5. **Error handling**: Centralized error handling

### Service Implementation

**Service Layer Structure**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    private chatService: ChatService,
    private unreadCountService: UnreadCountService,
    private pubSub: PubSub,
  ) {}

  async create(createMessageInput: CreateMessageInput): Promise<Message> {
    // 1. Business logic validation
    const isParticipant = await this.chatService.isParticipant(
      createMessageInput.chatId,
      createMessageInput.senderId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('User is not a participant in this chat');
    }

    // 2. Data persistence
    const message = this.messageRepository.create(createMessageInput);
    const savedMessage = await this.messageRepository.save(message);

    // 3. Side effects
    await this.publishEvents(savedMessage, createMessageInput);
    await this.updateUnreadCounts(savedMessage, createMessageInput);

    return savedMessage;
  }

  private async publishEvents(message: Message, input: CreateMessageInput): Promise<void> {
    await this.pubSub.publish('messageAdded', { messageAdded: message });
    await this.pubSub.publish('chatMessageNotification', {
      chatMessageNotification: {
        chatId: input.chatId,
        message,
        senderId: input.senderId,
      },
    });
  }

  private async updateUnreadCounts(message: Message, input: CreateMessageInput): Promise<void> {
    const chat = await this.chatService.findOne(input.chatId);
    const otherParticipants = chat.participantIds.filter(id => id !== input.senderId);
    
    for (const participantId of otherParticipants) {
      await this.unreadCountService.incrementUnreadCount(input.chatId, participantId);
    }
  }
}
```

### Why Not Directly in Resolvers?

#### 1. **Resolver Should Be Thin**
```typescript
// ❌ Bad - Business logic in resolver
@Mutation(() => Message)
async createMessage(@Args('createMessageInput') input: CreateMessageInput): Promise<Message> {
  // Validation logic
  const chat = await this.chatRepository.findOne({ where: { id: input.chatId } });
  if (!chat.participantIds.includes(input.senderId)) {
    throw new ForbiddenException('Not a participant');
  }
  
  // Business logic
  const message = await this.messageRepository.save(input);
  
  // Side effects
  await this.pubSub.publish('messageAdded', { messageAdded: message });
  
  return message;
}

// ✅ Good - Thin resolver, business logic in service
@Mutation(() => Message)
async createMessage(@Args('createMessageInput') input: CreateMessageInput): Promise<Message> {
  return this.messageService.create(input);
}
```

#### 2. **Reusability**
```typescript
// Service can be used by multiple resolvers
@Resolver(() => Message)
export class MessageResolver {
  constructor(private messageService: MessageService) {}

  @Mutation(() => Message)
  async createMessage(@Args('input') input: CreateMessageInput): Promise<Message> {
    return this.messageService.create(input);
  }
}

@Resolver(() => Chat)
export class ChatResolver {
  constructor(private messageService: MessageService) {}

  @ResolveField(() => [Message])
  async messages(@Parent() chat: Chat): Promise<Message[]> {
    return this.messageService.findAll(chat.id);
  }
}
```

### File References
- **Services**: `backend/*/src/*/services/*.service.ts`
- **Usage**: In all resolvers

## 🧩 Module Pattern

### Why NestJS Modules?

**Primary Reasons**:
1. **Organization**: Logical grouping of related components
2. **Dependency management**: Clear dependency graph
3. **Encapsulation**: Hide internal implementation
4. **Reusability**: Modules can be imported elsewhere
5. **Configuration**: Centralized module configuration

### Module Implementation

**Module Structure**:
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageRead]),
    ChatModule,
  ],
  providers: [
    MessageService,
    MessageResolver,
  ],
  exports: [
    MessageService,
  ],
})
export class MessageModule {}
```

### Dependency Graph

**Module Dependencies**:
```typescript
// AppModule imports all feature modules
@Module({
  imports: [
    TypeOrmModule.forRoot({ /* database config */ }),
    GraphQLModule.forRoot({ /* GraphQL config */ }),
    ChatModule,
    MessageModule,
    UserModule,
  ],
  providers: [DateTimeScalar],
})
export class AppModule {}

// Feature modules import shared modules
@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
```

### Benefits

#### 1. **Clear Boundaries**
```typescript
// Each module has clear responsibilities
@Module({
  providers: [UserService, UserResolver],
  exports: [UserService], // Only export what others need
})
export class UserModule {}

@Module({
  imports: [UserModule], // Import only what we need
  providers: [MessageService],
})
export class MessageModule {}
```

#### 2. **Testing Isolation**
```typescript
// Test individual modules
describe('MessageModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MessageModule],
    }).compile();
  });
});
```

### File References
- **Modules**: `backend/*/src/*/modules/*.module.ts`
- **App Module**: `backend/*/src/app.module.ts`

## 🔒 Singleton Pattern

### Why Singleton for PubSub?

**Primary Reasons**:
1. **Shared state**: Single Redis connection pool
2. **Resource efficiency**: Avoid multiple connections
3. **Configuration**: Single configuration point
4. **Lifecycle**: Framework manages lifecycle
5. **Consistency**: Same instance across application

### Singleton Implementation

**PubSub Provider**:
```typescript
// Singleton provider
export const pubSub = new RedisPubSub({
  publisher: new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  }),
  subscriber: new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  }),
});

// Usage in services
@Injectable()
export class MessageService {
  constructor(
    @Inject('PUBSUB') private pubSub: PubSub
  ) {}
}
```

### Why Separate Publisher/Subscriber Connections?

#### 1. **Connection Optimization**
```typescript
// Publisher connection optimized for writes
publisher: new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  // Optimized for publishing
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
}),

// Subscriber connection optimized for reads
subscriber: new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  // Optimized for subscribing
  lazyConnect: true,
  maxRetriesPerRequest: null, // Never timeout on subscriptions
}),
```

#### 2. **Failure Isolation**
```typescript
// Publisher failure doesn't affect subscribers
// Subscriber failure doesn't affect publishers
// Each connection can be monitored independently
```

### File References
- **Provider**: `backend/*/src/common/redis-pubsub.provider.ts`
- **Usage**: Throughout services

## 🏭 Factory Pattern

### Why Factory for Apollo Client?

**Primary Reasons**:
1. **Dynamic creation**: Create clients with different configurations
2. **Instance switching**: Support multiple backend instances
3. **Configuration**: Centralized client configuration
4. **Lifecycle management**: Handle client creation and cleanup
5. **Testing**: Easy to create test clients

### Apollo Client Factory Implementation

**Factory Function**:
```typescript
export const createApolloClient = () => {
  // Close existing connections
  if (currentApolloClient) {
    console.log('Closing existing Apollo client and WebSocket connections...');
    currentApolloClient.stop();
  }
  
  const receiverPort = getReceiverPort();
  console.log('Creating new Apollo client with receiver port:', receiverPort);
  
  // Create WebSocket link with current port
  const wsClient = createClient({
    url: `ws://localhost:${receiverPort}/graphql`,
    connectionParams: () => {
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      return {
        'user-id': userId || '',
        'username': username || '',
      };
    },
    shouldRetry: () => true,
    retryAttempts: 5,
  });
  
  const wsLink = new GraphQLWsLink(wsClient);
  
  const newClient = new ApolloClient({
    link: split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === Kind.OPERATION_DEFINITION &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLinkWithAuth
    ),
    cache: new InMemoryCache(),
  });
  
  currentApolloClient = newClient;
  return newClient;
};
```

### Benefits

#### 1. **Instance Switching**
```typescript
// User can switch between backend instances
const switchToInstance = (instance: number) => {
  localStorage.setItem('receiverPort', getPortForInstance(instance));
  const newClient = createApolloClient();
  // All components automatically use new client
};
```

#### 2. **Testing Support**
```typescript
// Create test client with mocked endpoints
const createTestApolloClient = (mockLink: ApolloLink) => {
  return new ApolloClient({
    link: mockLink,
    cache: new InMemoryCache(),
  });
};
```

### File References
- **Factory**: `frontend/src/apollo/client.ts`
- **Usage**: Throughout frontend components

## 👀 Observer Pattern

### Why Observer for WebSocket Subscriptions?

**Primary Reasons**:
1. **Real-time updates**: Automatic UI updates
2. **Decoupling**: Components don't know about subscription details
3. **Multiple observers**: Multiple components can observe same data
4. **Event handling**: Clean event handling mechanism
5. **Lifecycle management**: Automatic subscription management

### WebSocket Subscription Implementation

**Observer Setup**:
```typescript
// Component subscribes to events
const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  // Observer pattern - component automatically updates when data changes
  const { data, loading, error } = useSubscription(MESSAGE_ADDED, {
    variables: { chatId },
    onData: ({ data: subscriptionData }) => {
      // Observer receives updates
      console.log('New message received:', subscriptionData.messageAdded);
    },
    onError: (error) => {
      // Handle errors
      console.error('Subscription error:', error);
    },
  });

  // UI automatically re-renders when data changes
  return (
    <div>
      {data?.messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
    </div>
  );
};
```

### Multiple Observers

**Same Data, Multiple Components**:
```typescript
// ChatWindow observes messages
const ChatWindow = ({ chatId }) => {
  useSubscription(MESSAGE_ADDED, { variables: { chatId } });
  // Updates chat window
};

// ChatList observes same messages
const ChatList = () => {
  useSubscription(MESSAGE_ADDED);
  // Updates chat list with new message indicators
};

// UnreadCount observes unread updates
const UnreadIndicator = ({ chatId }) => {
  useSubscription(UNREAD_COUNT_UPDATED, { variables: { chatId } });
  // Updates unread count badge
};
```

### File References
- **Subscriptions**: `frontend/src/components/*.tsx`
- **Hooks**: `frontend/src/hooks/useUnreadCounts.ts`

## 🎯 Strategy Pattern

### Why Strategy for Operation Routing?

**Primary Reasons**:
1. **Dynamic routing**: Route operations based on type
2. **Extensibility**: Easy to add new routing rules
3. **Separation**: Routing logic separate from business logic
4. **Testing**: Easy to test routing strategies
5. **Configuration**: Centralized routing configuration

### Apollo Client Routing Strategy

**Routing Implementation**:
```typescript
// Strategy pattern - different routing based on operation type
const routingLink = new ApolloLink((operation, forward) => {
  const isChatMsg = isChatMessageOperation(operation);
  const isMut = isMutation(operation);
  
  // Strategy 1: User operations → User Service
  if (!isChatMsg) {
    operation.setContext({
      uri: 'http://localhost:4001/graphql'
    });
  }
  // Strategy 2: Chat/Message mutations → Sender Service
  else if (isMut) {
    operation.setContext({
      uri: `http://localhost:${getSenderPort()}/graphql`
    });
  }
  // Strategy 3: Chat/Message queries → Receiver Service
  else {
    operation.setContext({
      uri: `http://localhost:${getReceiverPort()}/graphql`
    });
  }
  
  return forward(operation);
});
```

### Operation Classification Strategy

**Operation Type Detection**:
```typescript
// Strategy for classifying operations
const isChatMessageOperation = (operation: any) => {
  const definition = getMainDefinition(operation.query) as OperationDefinitionNode;
  const operationName = operation.operationName || definition.name?.value || '';
  
  const chatMessageOperations = [
    'chats', 'chat', 'chatsByParticipant',
    'messages', 'message', 'messageReadStatus',
    'createChat', 'addParticipant', 'addParticipants',
    'createMessage', 'updateMessage', 'removeMessage',
    'messageAdded', 'messageUpdated', 'messageDeleted',
    // ... more operations
  ];
  
  return chatMessageOperations.some(op => 
    operationName.toLowerCase().includes(op.toLowerCase())
  );
};

const isMutation = (operation: any) => {
  const definition = getMainDefinition(operation.query);
  return definition.kind === Kind.OPERATION_DEFINITION && 
         definition.operation === 'mutation';
};
```

### Benefits

#### 1. **Extensibility**
```typescript
// Easy to add new routing strategies
const routingLink = new ApolloLink((operation, forward) => {
  if (isAdminOperation(operation)) {
    operation.setContext({ uri: ADMIN_SERVICE_URL });
  } else if (isAnalyticsOperation(operation)) {
    operation.setContext({ uri: ANALYTICS_SERVICE_URL });
  } else {
    // Default routing logic
  }
  
  return forward(operation);
});
```

#### 2. **Testing**
```typescript
// Easy to test routing strategies
describe('Operation Routing', () => {
  it('should route mutations to sender service', () => {
    const operation = createMockOperation('createMessage');
    const context = routingLink.request(operation, () => {});
    expect(context.uri).toContain('sender');
  });
});
```

### File References
- **Routing**: `frontend/src/apollo/client.ts`
- **Usage**: Automatic routing in all GraphQL operations

## 📊 Pattern Summary

| Pattern | Purpose | Implementation | Benefits |
|---------|---------|----------------|----------|
| **Dependency Injection** | Loose coupling, testability | NestJS DI container | Easy mocking, flexible configuration |
| **Repository** | Data access abstraction | TypeORM repositories | Testable, consistent data access |
| **Resolver** | GraphQL field resolution | NestJS resolvers | Type safety, field-level logic |
| **PubSub** | Event-driven communication | Redis PubSub | Real-time, decoupled, scalable |
| **Custom Scalar** | Type safety | GraphQL scalars | Validation, serialization |
| **Input DTOs** | Input validation | class-validator | Type safety, validation |
| **Entity Decorators** | Database mapping | TypeORM decorators | Schema generation, relationships |
| **Service Layer** | Business logic separation | NestJS services | Reusable, testable, organized |
| **Module** | Component organization | NestJS modules | Dependency management, encapsulation |
| **Singleton** | Shared resources | PubSub provider | Resource efficiency, consistency |
| **Factory** | Dynamic object creation | Apollo Client factory | Configuration, lifecycle management |
| **Observer** | Event subscription | React subscriptions | Real-time updates, decoupling |
| **Strategy** | Algorithm selection | Operation routing | Extensibility, separation of concerns |

Each pattern serves a specific purpose in creating a maintainable, scalable, and type-safe system. The combination of these patterns creates a robust architecture that supports the real-time, multi-instance requirements of the chat system.
