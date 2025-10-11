# Architecture and Technical Decisions

## 🏗️ System Architecture

### High-Level Design

The real-time chat system follows a **segregated microservices architecture** with clear separation between read and write operations for optimal scaling:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Frontend Layer                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     React Application                             │  │
│  │  • Apollo Client with Smart Routing                              │  │
│  │  • WebSocket Subscriptions to Receiver Service                   │  │
│  │  • Mutations routed to Sender Service                            │  │
│  │  • Queries routed to Receiver Service                            │  │
│  │  • Instance Selection for Testing                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend Services                               │
│                                                                          │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │User Service  │  │ Sender Service    │  │ Receiver Service       │  │
│  │(Ports 4001,  │  │ (Ports 4002,4004) │  │ (Ports 4005, 4006)     │  │
│  │      4003)   │  │                   │  │                        │  │
│  │              │  │ WRITE OPERATIONS: │  │ READ OPERATIONS:       │  │
│  │• User CRUD   │  │ • createChat      │  │ • chats                │  │
│  │• Validation  │  │ • createMessage   │  │ • messages             │  │
│  │• GraphQL API │  │ • updateMessage   │  │ • unreadCounts         │  │
│  │              │  │ • removeMessage   │  │                        │  │
│  │              │  │ • markAsRead      │  │ SUBSCRIPTIONS:         │  │
│  │              │  │ • addParticipant  │  │ • messageAdded         │  │
│  │              │  │                   │  │ • chatAdded            │  │
│  │              │  │ PUBLISHES TO:     │  │ • unreadCountUpdated   │  │
│  │              │  │ • Redis PubSub    │  │                        │  │
│  │              │  │                   │  │ LISTENS TO:            │  │
│  │              │  │                   │  │ • Redis PubSub         │  │
│  └──────────────┘  └───────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                │                      │                        │
                │                      │                        │
                │                      ▼                        │
                │            ┌─────────────────┐               │
                │            │  Redis PubSub   │               │
                │            │  • messageAdded │               │
                │            │  • chatAdded    │               │
                │            │  • chatUpdated  │               │
                │            │  • unreadUpdate │               │
                │            └─────────────────┘               │
                │                                               │
                └────────────────────┬──────────────────────────┘
                                     ▼
                      ┌─────────────────────────────┐
                      │   PostgreSQL Database       │
                      │   • users                   │
                      │   • chats                   │
                      │   • messages                │
                      │   • message_reads           │
                      │   • unread_counts           │
                      └─────────────────────────────┘
```

## 🎯 Design Decisions

### 1. Service Segregation (Read/Write Separation)

**Decision**: Separate Sender (Write) and Receiver (Read) Services

**Rationale**:
- **Independent Scaling**: Read and write loads can be scaled independently
- **Performance Optimization**: Each service optimized for its specific operations
- **Resource Efficiency**: Allocate more resources to high-load operations
- **Clear Responsibility**: Write operations don't interfere with read operations

**Trade-offs**:
- ✅ Better scalability for different load patterns
- ✅ Independent optimization strategies
- ✅ Fault isolation between read and write paths
- ❌ Increased complexity in service communication
- ❌ Eventual consistency considerations

**Implementation**:
```typescript
// Sender Service - Mutations only
@Resolver(() => Message)
export class MessageResolver {
  @Mutation(() => Message)
  async createMessage(...) {
    // Create message in database
    await this.messageService.create(...);
    
    // Publish to Redis for real-time delivery
    await pubSub.publish('messageAdded', {...});
    
    // Increment unread counts
    await this.unreadCountService.increment(...);
  }
}

// Receiver Service - Queries and Subscriptions
@Resolver(() => Message)
export class MessageResolver {
  @Query(() => [Message])
  async messages(@Args('chatId') chatId: string) {
    return this.messageService.findAll(chatId);
  }
  
  @Subscription(() => Message)
  async messageAdded(@Args('chatId') chatId: string) {
    // Listen to Redis PubSub
    return pubSub.asyncIterator('messageAdded');
  }
}
```

### 2. Redis PubSub for Multi-Instance Communication

**Decision**: Use Redis as centralized message broker

**Rationale**:
- **Cross-Instance Communication**: All instances share the same message bus
- **Scalability**: Supports multiple backend instances
- **Real-time Delivery**: Efficient pub/sub mechanism
- **Reliability**: Persistent connection with automatic reconnection

**Implementation**:
```typescript
// Redis PubSub Provider
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

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

// Usage in Sender Service
await pubSub.publish('messageAdded', { messageAdded: message });

// Usage in Receiver Service
return pubSub.asyncIterator('messageAdded');
```

### 3. Unread Message Indicator System

**Decision**: Database-backed unread counts with real-time updates

**Rationale**:
- **Persistent State**: Unread counts survive server restarts
- **Cross-Device Sync**: Same unread status on all devices
- **Efficient Queries**: Dedicated table with proper indexing
- **Real-time Updates**: WebSocket subscriptions for instant updates

**Database Schema**:
```sql
CREATE TABLE unread_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_unread_counts_chat_id ON unread_counts(chat_id);
CREATE INDEX idx_unread_counts_user_id ON unread_counts(user_id);
```

**Flow**:
1. **Message Sent**: Sender service increments unread count for all participants (except sender)
2. **Publish Update**: Redis PubSub broadcasts unread count change
3. **Real-time UI Update**: Receiver service pushes update via WebSocket
4. **Message Viewed**: User opens chat, marks messages as read
5. **Reset Count**: Sender service resets unread count to 0
6. **Update UI**: Blue dot disappears from chat list

### 4. Read Receipts System

**Decision**: Track message reads per user with subscription updates

**Rationale**:
- **Transparency**: Users know when messages are read
- **Social Engagement**: Encourages timely responses
- **Privacy Balance**: Only shows read status to participants
- **Simple UI**: Blue/gray tick indicator

**Database Schema**:
```sql
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);
```

**Implementation**:
```typescript
// Automatic read marking when viewing chat
useEffect(() => {
  messages.forEach(async (message) => {
    if (message.senderId !== userId && !markedAsRead.has(message.id)) {
      await markMessageAsRead({
        variables: { messageId: message.id, userId }
      });
    }
  });
}, [messages, userId]);

// Read receipt indicator component
const ReadReceiptIndicator = ({ messageId, senderId, currentUserId }) => {
  const { data } = useQuery(GET_MESSAGE_READ_STATUS, {
    variables: { messageId }
  });
  
  const isFullyRead = data?.messageReadStatus?.isFullyRead;
  
  return senderId === currentUserId ? (
    <i className={`bi bi-check-all ${isFullyRead ? 'text-primary' : 'text-muted'}`} />
  ) : null;
};
```

### 5. GraphQL API Design

**Decision**: GraphQL for all API communication with code-first approach

**Rationale**:
- **Type Safety**: TypeScript integration with automatic type generation
- **Efficient Data Fetching**: Clients request only needed fields
- **Real-time Built-in**: Native support for WebSocket subscriptions
- **Schema Evolution**: Easy to add fields without breaking changes
- **Developer Experience**: Self-documenting API with GraphQL Playground

**Code-First Schema**:
```typescript
@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field()
  senderId: string;

  @Field(() => Date)
  createdAt: Date;
}

// Custom DateTime Scalar
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  serialize(value: any): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return new Date().toISOString();
  }
  
  parseValue(value: string): Date {
    return new Date(value);
  }
}
```

### 6. Frontend Smart Routing

**Decision**: Client-side routing based on operation type

**Rationale**:
- **Transparent**: Frontend doesn't need to know service details
- **Flexible**: Easy to change service endpoints
- **Testable**: Can manually select instances for testing
- **Efficient**: Direct connection to appropriate service

**Implementation**:
```typescript
// Routing logic in Apollo Client
const routingLink = new ApolloLink((operation, forward) => {
  const isChatMsg = isChatMessageOperation(operation);
  const isMut = isMutation(operation);
  
  if (!isChatMsg) {
    // User operations → User Service
    operation.setContext({ uri: 'http://localhost:4001/graphql' });
  } else if (isMut) {
    // Chat/Message mutations → Sender Service
    operation.setContext({ uri: `http://localhost:${getSenderPort()}/graphql` });
  } else {
    // Chat/Message queries → Receiver Service
    operation.setContext({ uri: `http://localhost:${getReceiverPort()}/graphql` });
  }
  
  return forward(operation);
});
```

### 7. Database Design

**Decision**: PostgreSQL with TypeORM and JSONB for flexibility

**Rationale**:
- **ACID Compliance**: Data consistency guarantees
- **JSON Support**: Store participant arrays efficiently
- **Performance**: Excellent for read-heavy workloads
- **TypeORM**: Type-safe database operations
- **Indexing**: Fast lookups on frequently queried fields

**Entity Relationships**:
```typescript
@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  participantIds: string[];

  @OneToMany(() => Message, message => message.chat)
  messages: Message[];
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, chat => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @OneToMany(() => MessageRead, read => read.message)
  reads: MessageRead[];
}

@Entity('message_reads')
export class MessageRead {
  @ManyToOne(() => Message, message => message.reads)
  @JoinColumn({ name: 'message_id' })
  message: Message;
}
```

## 🔄 Data Flow Patterns

### 1. Message Sending Flow

```
User Input → React Component
    ↓
Apollo Mutation → Sender Service (Port 4002/4004)
    ↓
Validate User → Check Participation → Create Message
    ↓
Save to Database (messages table)
    ↓
Increment Unread Counts (unread_counts table)
    ↓
Publish to Redis PubSub → 'messageAdded' channel
    ↓
Receiver Service Instances (Port 4005/4006) Listen
    ↓
Push via WebSocket → All Subscribed Clients
    ↓
Apollo Client Cache Update → UI Renders New Message
```

### 2. Unread Indicator Flow

```
Message Created → Sender Service
    ↓
For each participant (except sender):
    Increment unread_counts.unread_count
    ↓
    Publish 'unreadCountUpdated' to Redis
    ↓
Receiver Service → WebSocket Subscription
    ↓
Frontend useUnreadCounts Hook
    ↓
ChatList Component → Show Blue Dot with Count
    
User Opens Chat:
    ↓
Auto-mark messages as read → Sender Service
    ↓
Reset unread_counts.unread_count to 0
    ↓
Publish 'unreadCountUpdated' to Redis
    ↓
Frontend Hook → Remove Blue Dot
```

### 3. Read Receipt Flow

```
User Views Chat → Messages Load
    ↓
Auto-mark unread messages → markMessageAsRead mutation
    ↓
Sender Service → Create message_reads record
    ↓
Check if all participants have read
    ↓
Publish 'messageReadUpdated' to Redis
    ↓
Receiver Service → WebSocket Subscription
    ↓
Frontend ReadReceiptIndicator Component
    ↓
Query messageReadStatus
    ↓
Show Blue Tick (all read) or Gray Tick (not all read)
```

## 🚀 Scalability Patterns

### 1. Horizontal Scaling Strategy

**Multiple Service Instances**:
- **User Service**: 2 instances (can scale to N)
- **Sender Service**: 2 instances (scale based on write load)
- **Receiver Service**: 2 instances (scale based on read load + subscriptions)

**Load Distribution**:
```
Frontend Request
    ↓
Load Balancer (can be added)
    ↓
Round-robin or least-connections
    ↓
Service Instance 1, 2, 3, ... N
```

**Benefits**:
- ✅ Handle more concurrent users
- ✅ Fault tolerance (if one instance fails, others handle requests)
- ✅ Zero-downtime deployments
- ✅ Independent scaling per service type

### 2. Database Optimization

**Connection Pooling**:
```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  // ... connection details
  extra: {
    max: 20,           // Maximum pool size
    min: 5,            // Minimum pool size
    idle: 10000,       // Close idle connections after 10s
    acquire: 30000,    // Timeout for getting connection
  },
})
```

**Indexing Strategy**:
```sql
-- Frequently queried fields
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_unread_counts_user_id ON unread_counts(user_id);
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);

-- Composite indexes for common queries
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at);
```

**Query Optimization**:
```typescript
// Efficient message fetching with relations
return this.messageRepository.find({
  where: { chatId },
  order: { createdAt: 'ASC' },
  take: 50,  // Pagination
  cache: true,  // Query result caching
});
```

### 3. Caching Strategy

**Apollo Client Cache**:
```typescript
export const apolloClient = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          messages: {
            keyArgs: ['chatId'],
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
});
```

**Benefits**:
- Automatic query result caching
- Optimistic updates for better UX
- Cache invalidation on mutations
- Reduced server requests

### 4. WebSocket Connection Management

**Robust Connection Handling**:
```typescript
const wsClient = createClient({
  url: `ws://localhost:${receiverPort}/graphql`,
  connectionParams: () => ({
    'user-id': userId,
    'username': username,
  }),
  shouldRetry: () => true,
  retryAttempts: 5,
  retryWait: (retries) => Math.min(retries * 1000, 5000),
  on: {
    connected: () => console.log('WebSocket connected'),
    error: (error) => console.error('WebSocket error:', error),
    closed: () => console.log('WebSocket closed'),
  },
});
```

**Client Recreation on Instance Change**:
```typescript
export const createApolloClient = () => {
  // Close existing connections
  if (currentApolloClient) {
    currentApolloClient.stop();
  }
  
  // Create new client with current port
  const receiverPort = getReceiverPort();
  const wsClient = createClient({
    url: `ws://localhost:${receiverPort}/graphql`,
    // ... configuration
  });
  
  currentApolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
  });
  
  return currentApolloClient;
};
```

## 🔒 Security Implementation

### 1. Authorization Checks

**Message Operations**:
```typescript
// Only sender can edit/delete
async update(id: string, content: string, userId: string) {
  const message = await this.findOne(id);
  
  if (message.senderId !== userId) {
    throw new ForbiddenException('Only the sender can edit this message');
  }
  
  // Update message...
}

// Only participants can send messages
async create(createMessageInput: CreateMessageInput) {
  const isParticipant = await this.chatService.isParticipant(
    createMessageInput.chatId,
    createMessageInput.senderId
  );
  
  if (!isParticipant) {
    throw new ForbiddenException('User is not a participant in this chat');
  }
  
  // Create message...
}
```

### 2. Input Validation

**Class-validator Integration**:
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
  @IsUUID()
  senderId: string;

  @Field()
  @IsNotEmpty()
  @IsUUID()
  chatId: string;
}
```

### 3. SQL Injection Prevention

**TypeORM Parameterized Queries**:
```typescript
// Safe - TypeORM handles parameterization
return this.messageRepository.find({
  where: { chatId: chatId },  // Automatically parameterized
});

// Also safe - query builder with parameters
return this.messageRepository
  .createQueryBuilder('message')
  .where('message.chatId = :chatId', { chatId })
  .getMany();
```

## 🧪 Testing Strategy

### 1. Unit Testing

**Service Layer**:
```typescript
describe('MessageService', () => {
  it('should create a message and increment unread counts', async () => {
    const message = await messageService.create({
      content: 'Test message',
      senderId: 'user1',
      chatId: 'chat1',
    });
    
    expect(message.content).toBe('Test message');
    
    // Verify unread count incremented
    const unreadCount = await unreadCountService.getUnreadCount('chat1', 'user2');
    expect(unreadCount).toBe(1);
  });
});
```

### 2. Integration Testing

**Cross-Service Communication**:
```typescript
describe('Multi-Service Integration', () => {
  it('should handle message flow from sender to receiver', async () => {
    // Send message via Sender Service
    await senderService.createMessage({...});
    
    // Query via Receiver Service
    const messages = await receiverService.getMessages(chatId);
    
    expect(messages).toHaveLength(1);
  });
});
```

### 3. E2E Testing

**Complete User Flows**:
```typescript
describe('Complete Chat Flow', () => {
  it('should create users, chat, send messages, and handle read receipts', async () => {
    // Create users → Create chat → Send messages → Mark as read
    // Verify all steps work together
  });
});
```

## 🔮 Future Architecture Considerations

### 1. Advanced Scaling

**API Gateway**:
- Centralized entry point
- Rate limiting and throttling
- Authentication/Authorization
- Request routing and load balancing

**Service Mesh (Istio/Linkerd)**:
- Service-to-service communication
- Traffic management
- Observability
- Security (mTLS)

### 2. Data Architecture

**CQRS Pattern**:
- Separate read and write models
- Event sourcing for message history
- Materialized views for queries

**Database Sharding**:
- Shard by user ID or chat ID
- Distribute data across multiple databases
- Handle cross-shard queries

**Message Archiving**:
- Move old messages to separate storage
- Reduce primary database size
- Cold storage for compliance

### 3. Enhanced Monitoring

**Observability Stack**:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation and analysis

**Key Metrics to Track**:
- Request latency (p50, p95, p99)
- Error rates
- Active WebSocket connections
- Database query performance
- Redis pub/sub latency
- Message delivery times

## 📈 Monitoring and Observability

### Health Checks

All services include comprehensive health checks:

```typescript
@Get('health')
async health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await this.checkDatabaseConnection(),
    redis: await this.checkRedisConnection(),
  };
}
```

### Logging Strategy

**Structured Logging**:
```typescript
// Service-level logging
this.logger.log(`Message created: ${message.id}`, {
  chatId: message.chatId,
  senderId: message.senderId,
  timestamp: new Date().toISOString(),
});

// Error logging
this.logger.error(`Failed to create message`, {
  error: error.message,
  stack: error.stack,
  context: { chatId, userId },
});
```

## 🎯 Trade-offs and Decisions

### Current Limitations

1. **Eventual Consistency**: Redis PubSub introduces slight delay
2. **Single Database**: Potential bottleneck for very high scale
3. **No Authentication**: Simple user management without JWT
4. **File Attachments**: Text-only messages currently
5. **Message History**: No pagination or archiving strategy yet

### Architectural Trade-offs

| Aspect | Decision | Benefit | Cost |
|--------|----------|---------|------|
| Service Segregation | Separate Read/Write | Independent scaling | Increased complexity |
| Redis PubSub | Centralized message bus | Multi-instance support | Single point of failure |
| GraphQL | Type-safe API | Developer experience | Learning curve |
| Code-First | TypeScript-generated schema | Type safety | Less schema control |
| WebSocket | Real-time updates | Instant delivery | Connection overhead |
| JSONB Arrays | Flexible participant storage | Easy to query | Less normalized |

### Why These Decisions Were Made

1. **Service Segregation**: Read-heavy applications benefit from specialized read services
2. **Redis PubSub**: Simple, reliable, and scales well for pub/sub use case
3. **GraphQL**: Type safety and real-time subscriptions made it ideal for chat
4. **Code-First**: TypeScript integration eliminates schema drift
5. **WebSocket**: Required for real-time messaging experience
6. **JSONB**: PostgreSQL's JSONB is efficient for arrays and flexible for future changes

---

This architecture provides a solid foundation for a scalable real-time chat system while maintaining simplicity and developer experience. The design can evolve as requirements grow, with clear paths for adding authentication, file sharing, advanced scaling, and more sophisticated features.
