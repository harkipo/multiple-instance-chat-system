# Redis PubSub Architecture

## 🔴 Overview

This document provides a comprehensive analysis of the Redis PubSub architecture, explaining how it enables multi-instance real-time communication, message flow patterns, and the design decisions behind the implementation.

## 🏗️ Architecture Deep Dive

### Redis PubSub in the System

**Role**: Central message broker for cross-instance communication
**Purpose**: Enable real-time messaging across multiple backend instances
**Implementation**: Separate publisher and subscriber connections for optimization

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Multi-Instance Setup                          │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Sender Service  │  │ Sender Service  │  │ Sender Service  │         │
│  │   Instance 1    │  │   Instance 2    │  │   Instance N    │         │
│  │   (Port 4002)   │  │   (Port 4004)   │  │   (Port 400X)   │         │
│  └─────────┬───────┘  └─────────┬───────┘  └─────────┬───────┘         │
│            │                    │                    │                 │
│            │                    │                    │                 │
│            │  ┌─────────────────┼─────────────────────┼─────────────┐   │
│            │  │                 │                     │             │   │
│            ▼  ▼                 ▼                     ▼             ▼   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Redis PubSub Broker                             │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │ │
│  │  │ messageAdded│ │ chatAdded   │ │ unreadCount │ │ messageRead │  │ │
│  │  │   Channel   │ │   Channel   │ │   Channel   │ │   Channel   │  │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│            │                    │                    │                 │
│            │                    │                    │                 │
│            │  ┌─────────────────┼─────────────────────┼─────────────┐   │
│            │  │                 │                     │             │   │
│            ▼  ▼                 ▼                     ▼             ▼   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Receiver Service│  │ Receiver Service│  │ Receiver Service│         │
│  │   Instance 1    │  │   Instance 2    │  │   Instance N    │         │
│  │   (Port 4005)   │  │   (Port 4006)   │  │   (Port 400X)   │         │
│  └─────────┬───────┘  └─────────┬───────┘  └─────────┬───────┘         │
│            │                    │                    │                 │
│            │                    │                    │                 │
│            │  ┌─────────────────┼─────────────────────┼─────────────┐   │
│            │  │                 │                     │             │   │
│            ▼  ▼                 ▼                     ▼             ▼   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   WebSocket     │  │   WebSocket     │  │   WebSocket     │         │
│  │   Clients       │  │   Clients       │  │   Clients       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📡 Channel Design and Naming

### Channel Architecture

**Design Principle**: Each channel serves a specific purpose with clear naming conventions

### Channel List

#### 1. **messageAdded**
```typescript
// Channel: 'messageAdded'
// Purpose: Real-time message delivery to chat participants
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By chatId

await pubSub.publish('messageAdded', {
  messageAdded: {
    id: 'msg123',
    content: 'Hello world',
    senderId: 'user456',
    chatId: 'chat789',
    createdAt: '2024-01-01T12:00:00Z'
  }
});
```

#### 2. **chatMessageNotification**
```typescript
// Channel: 'chatMessageNotification'
// Purpose: User notification system for new messages
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By userId (exclude sender)

await pubSub.publish('chatMessageNotification', {
  chatMessageNotification: {
    chatId: 'chat789',
    message: messageData,
    senderId: 'user456'
  }
});
```

#### 3. **messageUpdateForChatList**
```typescript
// Channel: 'messageUpdateForChatList'
// Purpose: Update chat list previews with latest message
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By userId (exclude sender)

await pubSub.publish('messageUpdateForChatList', {
  messageUpdateForChatList: {
    chatId: 'chat789',
    message: messageData,
    senderId: 'user456'
  }
});
```

#### 4. **unreadCountUpdated**
```typescript
// Channel: 'unreadCountUpdated'
// Purpose: Real-time unread count updates
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By userId

await pubSub.publish('unreadCountUpdated', {
  unreadCountUpdated: {
    chatId: 'chat789',
    userId: 'user123',
    unreadCount: 5
  }
});
```

#### 5. **messageReadUpdated**
```typescript
// Channel: 'messageReadUpdated'
// Purpose: Read receipt updates
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By messageId

await pubSub.publish('messageReadUpdated', {
  messageReadUpdated: {
    messageId: 'msg123',
    userId: 'user456',
    readAt: '2024-01-01T12:05:00Z'
  }
});
```

#### 6. **chatAdded**
```typescript
// Channel: 'chatAdded'
// Purpose: New chat creation notifications
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By userId (participants only)

await pubSub.publish('chatAdded', {
  chatAdded: {
    id: 'chat789',
    name: 'Project Discussion',
    participantIds: ['user123', 'user456']
  }
});
```

#### 7. **chatUpdated**
```typescript
// Channel: 'chatUpdated'
// Purpose: Chat modification notifications
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By userId (participants only)

await pubSub.publish('chatUpdated', {
  chatUpdated: {
    id: 'chat789',
    name: 'Updated Project Discussion',
    participantIds: ['user123', 'user456', 'user789']
  }
});
```

#### 8. **messageUpdated**
```typescript
// Channel: 'messageUpdated'
// Purpose: Message edit notifications
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By chatId

await pubSub.publish('messageUpdated', {
  messageUpdated: {
    id: 'msg123',
    content: 'Hello world (edited)',
    chatId: 'chat789',
    isEdited: true,
    editedAt: '2024-01-01T12:10:00Z'
  }
});
```

#### 9. **messageDeleted**
```typescript
// Channel: 'messageDeleted'
// Purpose: Message deletion notifications
// Publisher: Sender Service
// Subscribers: Receiver Services
// Filter: By chatId

await pubSub.publish('messageDeleted', {
  messageDeleted: {
    id: 'msg123',
    chatId: 'chat789'
  }
});
```

### Channel Naming Conventions

**Pattern**: `{entity}{Action}`
- **messageAdded**: New message created
- **messageUpdated**: Message edited
- **messageDeleted**: Message removed
- **chatAdded**: New chat created
- **chatUpdated**: Chat modified

**Special Channels**:
- **chatMessageNotification**: User-specific notifications
- **messageUpdateForChatList**: Chat list updates
- **unreadCountUpdated**: Unread count changes
- **messageReadUpdated**: Read receipt updates

## 🔄 Message Flow Patterns

### 1. **Message Creation Flow**

```
User Input → Frontend → Sender Service → Database
                    ↓
            Redis PubSub → Receiver Services → WebSocket → All Clients
```

**Detailed Steps**:

#### Step 1: Message Creation
```typescript
// Sender Service receives message creation request
@Mutation(() => Message)
async createMessage(@Args('createMessageInput') input: CreateMessageInput): Promise<Message> {
  // 1. Validate user permissions
  const isParticipant = await this.chatService.isParticipant(input.chatId, input.senderId);
  
  // 2. Save message to database
  const message = await this.messageRepository.save(input);
  
  // 3. Update unread counts
  await this.updateUnreadCounts(message, input);
  
  // 4. Publish to Redis
  await this.publishMessageEvents(message, input);
  
  return message;
}
```

#### Step 2: Event Publishing
```typescript
private async publishMessageEvents(message: Message, input: CreateMessageInput): Promise<void> {
  // Publish to multiple channels for different purposes
  await Promise.all([
    // Direct message delivery
    pubSub.publish('messageAdded', { messageAdded: message }),
    
    // User notifications
    pubSub.publish('chatMessageNotification', {
      chatMessageNotification: {
        chatId: input.chatId,
        message,
        senderId: input.senderId
      }
    }),
    
    // Chat list updates
    pubSub.publish('messageUpdateForChatList', {
      messageUpdateForChatList: {
        chatId: input.chatId,
        message,
        senderId: input.senderId
      }
    })
  ]);
}
```

#### Step 3: Cross-Instance Broadcasting
```typescript
// All Receiver Service instances receive the event
@Subscription(() => Message)
async messageAdded(@Args('chatId') chatId: string) {
  return pubSub.asyncIterator('messageAdded');
}

// Event filtering at subscription level
@Subscription(() => Message, {
  filter: (payload, variables) => {
    return payload.messageAdded.chatId === variables.chatId;
  },
})
async messageAdded(@Args('chatId') chatId: string) {
  return pubSub.asyncIterator('messageAdded');
}
```

#### Step 4: Client Delivery
```typescript
// Receiver Service pushes to connected WebSocket clients
// Frontend receives real-time update
useSubscription(MESSAGE_ADDED, {
  variables: { chatId },
  onData: ({ data }) => {
    // Update UI with new message
    console.log('New message:', data.messageAdded);
  }
});
```

### 2. **Read Receipt Flow**

```
User Views Chat → Frontend → Sender Service → Database
                         ↓
                Redis PubSub → Receiver Services → WebSocket → All Clients
```

**Detailed Steps**:

#### Step 1: Mark as Read
```typescript
// User opens chat, messages auto-marked as read
@Mutation(() => MessageRead)
async markMessageAsRead(@Args('messageId') messageId: string, @Args('userId') userId: string): Promise<MessageRead> {
  // 1. Create read receipt
  const messageRead = await this.messageReadRepository.save({ messageId, userId });
  
  // 2. Reset unread count
  await this.unreadCountService.resetUnreadCount(message.chatId, userId);
  
  // 3. Publish read receipt update
  await pubSub.publish('messageReadUpdated', {
    messageReadUpdated: {
      messageId,
      userId,
      readAt: messageRead.readAt
    }
  });
  
  return messageRead;
}
```

#### Step 2: Read Receipt Broadcasting
```typescript
// All Receiver Service instances receive read receipt update
@Subscription(() => MessageReadUpdate)
async messageReadUpdated(@Args('messageId') messageId: string) {
  return pubSub.asyncIterator('messageReadUpdated');
}
```

#### Step 3: UI Updates
```typescript
// Frontend receives read receipt update
useSubscription(MESSAGE_READ_UPDATED, {
  variables: { messageId },
  onData: ({ data }) => {
    // Update read receipt indicators
    console.log('Read receipt updated:', data.messageReadUpdated);
  }
});
```

### 3. **Unread Count Flow**

```
Message Created → Sender Service → Unread Count Table
                         ↓
                Redis PubSub → Receiver Services → WebSocket → Client UI
```

**Detailed Steps**:

#### Step 1: Increment Unread Count
```typescript
// When message is created, increment unread count for all participants except sender
async updateUnreadCounts(message: Message, input: CreateMessageInput): Promise<void> {
  const chat = await this.chatService.findOne(input.chatId);
  const otherParticipants = chat.participantIds.filter(id => id !== input.senderId);
  
  for (const participantId of otherParticipants) {
    await this.unreadCountService.incrementUnreadCount(input.chatId, participantId);
  }
}
```

#### Step 2: Unread Count Publishing
```typescript
// Unread count service publishes updates
async incrementUnreadCount(chatId: string, userId: string): Promise<UnreadCount> {
  let unreadCount = await this.unreadCountRepository.findOne({
    where: { chatId, userId }
  });

  if (!unreadCount) {
    unreadCount = this.unreadCountRepository.create({ chatId, userId, unreadCount: 1 });
  } else {
    unreadCount.unreadCount += 1;
  }

  const savedUnreadCount = await this.unreadCountRepository.save(unreadCount);

  // Publish unread count update
  await pubSub.publish('unreadCountUpdated', {
    unreadCountUpdated: {
      chatId,
      userId,
      unreadCount: savedUnreadCount.unreadCount
    }
  });

  return savedUnreadCount;
}
```

#### Step 3: Real-time UI Updates
```typescript
// Frontend receives unread count updates
useSubscription(UNREAD_COUNT_UPDATED, {
  variables: { userId },
  onData: ({ data }) => {
    const { chatId, unreadCount } = data.unreadCountUpdated;
    // Update unread indicator in chat list
    updateUnreadIndicator(chatId, unreadCount);
  }
});
```

## ⚡ Ordering Guarantees

### Redis PubSub Ordering

**Redis PubSub Characteristics**:
- **Best-effort ordering**: Messages within a single channel are delivered in order
- **No guaranteed ordering**: Across different channels or instances
- **At-least-once delivery**: Messages may be delivered multiple times
- **No acknowledgment**: No built-in message acknowledgment system

### Our Ordering Strategy

#### 1. **Message Ordering**
```typescript
// Messages are ordered by database insertion order
const messages = await this.messageRepository.find({
  where: { chatId },
  order: { createdAt: 'ASC' } // Database timestamp provides ordering
});
```

#### 2. **Event Ordering**
```typescript
// Events are published in sequence to maintain order
async publishMessageEvents(message: Message, input: CreateMessageInput): Promise<void> {
  // Publish in sequence to maintain order
  await pubSub.publish('messageAdded', { messageAdded: message });
  await pubSub.publish('unreadCountUpdated', { unreadCountUpdated: unreadData });
  await pubSub.publish('messageUpdateForChatList', { messageUpdateForChatList: listData });
}
```

#### 3. **Client-side Ordering**
```typescript
// Frontend maintains message order
const [messages, setMessages] = useState<Message[]>([]);

useSubscription(MESSAGE_ADDED, {
  onData: ({ data }) => {
    setMessages(prev => {
      const newMessages = [...prev, data.messageAdded];
      // Sort by creation time to maintain order
      return newMessages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }
});
```

### Ordering Limitations

#### 1. **Cross-Channel Ordering**
- **No guarantee**: Events on different channels may arrive out of order
- **Mitigation**: Use timestamps for ordering when needed
- **Example**: `messageAdded` and `unreadCountUpdated` may arrive out of order

#### 2. **Cross-Instance Ordering**
- **No guarantee**: Events from different instances may arrive out of order
- **Mitigation**: Database timestamps provide authoritative ordering
- **Example**: Messages from different sender instances may arrive out of order

#### 3. **Network Partitioning**
- **No guarantee**: Events may be delayed or lost during network issues
- **Mitigation**: Automatic reconnection and retry logic
- **Example**: Temporary network issues may cause event delays

## 📨 Delivery Semantics

### At-Least-Once Delivery

**Redis PubSub Behavior**:
- **At-least-once**: Messages are delivered at least once
- **Possible duplicates**: Messages may be delivered multiple times
- **No acknowledgment**: No built-in acknowledgment system
- **No persistence**: Messages are not persisted if no subscribers

### Our Delivery Strategy

#### 1. **Idempotency Handling**
```typescript
// Handle duplicate messages gracefully
const processedMessages = new Set<string>();

useSubscription(MESSAGE_ADDED, {
  onData: ({ data }) => {
    const messageId = data.messageAdded.id;
    
    // Skip if already processed
    if (processedMessages.has(messageId)) {
      return;
    }
    
    processedMessages.add(messageId);
    // Process message
    handleNewMessage(data.messageAdded);
  }
});
```

#### 2. **Read Receipt Idempotency**
```typescript
// Read receipts are naturally idempotent
async markMessageAsRead(messageId: string, userId: string): Promise<MessageRead> {
  // Check if already marked as read
  const existingRead = await this.messageReadRepository.findOne({
    where: { messageId, userId }
  });

  if (existingRead) {
    return existingRead; // Return existing instead of creating duplicate
  }

  // Create new read receipt
  const messageRead = this.messageReadRepository.create({ messageId, userId });
  return this.messageReadRepository.save(messageRead);
}
```

#### 3. **Unread Count Idempotency**
```typescript
// Unread count operations are idempotent
async incrementUnreadCount(chatId: string, userId: string): Promise<UnreadCount> {
  let unreadCount = await this.unreadCountRepository.findOne({
    where: { chatId, userId }
  });

  if (!unreadCount) {
    unreadCount = this.unreadCountRepository.create({ chatId, userId, unreadCount: 1 });
  } else {
    unreadCount.unreadCount += 1; // Increment is idempotent
  }

  return this.unreadCountRepository.save(unreadCount);
}
```

### Delivery Failure Handling

#### 1. **Connection Failures**
```typescript
// Automatic reconnection with exponential backoff
const wsClient = createClient({
  url: `ws://localhost:${receiverPort}/graphql`,
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

#### 2. **Message Loss Handling**
```typescript
// Handle potential message loss
useSubscription(MESSAGE_ADDED, {
  onError: (error) => {
    console.error('Subscription error:', error);
    // Could implement message recovery logic here
    // For now, rely on user to refresh or reconnect
  }
});
```

#### 3. **Graceful Degradation**
```typescript
// Fallback to polling if WebSocket fails
const useMessagesWithFallback = (chatId: string) => {
  const [usePolling, setUsePolling] = useState(false);
  
  const { data: subscriptionData, error } = useSubscription(MESSAGE_ADDED, {
    variables: { chatId },
    skip: usePolling,
    onError: () => setUsePolling(true) // Fallback to polling
  });
  
  const { data: pollingData } = useQuery(GET_MESSAGES, {
    variables: { chatId },
    pollInterval: usePolling ? 5000 : 0 // Poll every 5 seconds if needed
  });
  
  return usePolling ? pollingData : subscriptionData;
};
```

## 🌐 Multi-Instance Coordination

### Instance Communication

**How Multiple Instances Coordinate**:

#### 1. **Shared Message Bus**
```typescript
// All instances share the same Redis PubSub
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
```

#### 2. **Event Broadcasting**
```typescript
// Sender instance publishes event
await pubSub.publish('messageAdded', { messageAdded: message });

// All receiver instances receive the event
@Subscription(() => Message)
async messageAdded(@Args('chatId') chatId: string) {
  return pubSub.asyncIterator('messageAdded');
}
```

#### 3. **Client Distribution**
```typescript
// Clients can be connected to any receiver instance
// All instances receive the same events and push to their clients
const receiverInstances = [
  'receiver-service-1:4005',
  'receiver-service-2:4006',
  'receiver-service-N:400X'
];

// Each instance pushes to its connected clients
receiverInstances.forEach(instance => {
  // Push event to clients connected to this instance
  pushToClients(instance, event);
});
```

### Load Distribution

#### 1. **Sender Instance Load**
```typescript
// Load can be distributed across sender instances
const senderInstances = [
  'sender-service-1:4002',
  'sender-service-2:4004'
];

// Frontend can route to different sender instances
const getSenderPort = () => {
  const instances = ['4002', '4004'];
  return instances[Math.floor(Math.random() * instances.length)];
};
```

#### 2. **Receiver Instance Load**
```typescript
// WebSocket connections distributed across receiver instances
const receiverInstances = [
  'receiver-service-1:4005',
  'receiver-service-2:4006'
];

// Frontend can connect to different receiver instances
const getReceiverPort = () => {
  const instances = ['4005', '4006'];
  return instances[Math.floor(Math.random() * instances.length)];
};
```

#### 3. **Event Distribution**
```typescript
// Events are distributed to all receiver instances
// Each instance pushes to its connected clients
const distributeEvent = async (event: any) => {
  await pubSub.publish('messageAdded', event);
  
  // All receiver instances receive the event
  // Each instance pushes to its connected WebSocket clients
};
```

## 🔧 Why Separate Publisher/Subscriber Connections

### Connection Optimization

#### 1. **Publisher Connection**
```typescript
// Optimized for write operations
publisher: new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  // Optimized for publishing
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  // Can handle connection failures
  lazyConnect: false,
  // Optimized for throughput
  enableOfflineQueue: false,
});
```

**Characteristics**:
- **Short-lived connections**: Can reconnect on failure
- **High throughput**: Optimized for publishing many messages
- **Retry logic**: Can retry failed publishes
- **Connection pooling**: Can use connection pooling for high load

#### 2. **Subscriber Connection**
```typescript
// Optimized for long-lived subscriptions
subscriber: new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  // Optimized for subscribing
  lazyConnect: true,
  maxRetriesPerRequest: null, // Never timeout on subscriptions
  // Must stay connected
  enableOfflineQueue: true,
  // Optimized for low latency
  keepAlive: true,
});
```

**Characteristics**:
- **Long-lived connections**: Must stay connected for subscriptions
- **Low latency**: Optimized for real-time delivery
- **No retries**: Cannot retry failed subscriptions
- **Persistent**: Must maintain connection for event delivery

### Failure Isolation

#### 1. **Publisher Failure**
```typescript
// If publisher fails, subscribers can still receive messages
// Publisher can reconnect without affecting subscribers
const handlePublisherFailure = () => {
  console.log('Publisher connection lost, reconnecting...');
  // Reconnect publisher
  // Subscribers continue to work
};
```

#### 2. **Subscriber Failure**
```typescript
// If subscriber fails, publishers can still send messages
// Subscriber can reconnect without affecting publishers
const handleSubscriberFailure = () => {
  console.log('Subscriber connection lost, reconnecting...');
  // Reconnect subscriber
  // Publishers continue to work
};
```

#### 3. **Independent Monitoring**
```typescript
// Can monitor each connection type separately
const monitorConnections = () => {
  // Monitor publisher health
  publisher.on('error', (error) => {
    console.error('Publisher error:', error);
    // Alert publisher issues
  });
  
  // Monitor subscriber health
  subscriber.on('error', (error) => {
    console.error('Subscriber error:', error);
    // Alert subscriber issues
  });
};
```

### Performance Benefits

#### 1. **Connection Pooling**
```typescript
// Publisher can use connection pooling for high throughput
const publisherPool = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
]);

// Subscriber uses single connection for consistency
const subscriber = new Redis({
  host: 'redis-1',
  port: 6379,
});
```

#### 2. **Resource Optimization**
```typescript
// Publisher: Optimized for CPU and memory for publishing
// Subscriber: Optimized for network and memory for receiving
// Different resource requirements
```

#### 3. **Scaling Characteristics**
```typescript
// Publisher: Can scale horizontally for high write load
// Subscriber: Can scale horizontally for high read load
// Independent scaling based on load patterns
```

## 🚨 Error Handling and Reconnection

### Connection Error Handling

#### 1. **Publisher Error Handling**
```typescript
// Publisher error handling
publisher.on('error', (error) => {
  console.error('Publisher Redis error:', error);
  // Publisher can reconnect without affecting subscribers
  // Messages may be lost during reconnection
});

publisher.on('connect', () => {
  console.log('Publisher Redis connected');
  // Publisher is ready to send messages
});

publisher.on('reconnecting', () => {
  console.log('Publisher Redis reconnecting...');
  // Publisher is attempting to reconnect
});
```

#### 2. **Subscriber Error Handling**
```typescript
// Subscriber error handling
subscriber.on('error', (error) => {
  console.error('Subscriber Redis error:', error);
  // Subscriber must reconnect to receive messages
  // Messages may be lost during reconnection
});

subscriber.on('connect', () => {
  console.log('Subscriber Redis connected');
  // Subscriber is ready to receive messages
});

subscriber.on('reconnecting', () => {
  console.log('Subscriber Redis reconnecting...');
  // Subscriber is attempting to reconnect
});
```

### Reconnection Strategy

#### 1. **Automatic Reconnection**
```typescript
// Redis client automatically reconnects
const redis = new Redis({
  host: 'redis',
  port: 6379,
  retryStrategy: (times) => {
    // Exponential backoff
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 3,
});
```

#### 2. **Health Monitoring**
```typescript
// Monitor Redis connection health
const healthCheck = async () => {
  try {
    await redis.ping();
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date() };
  }
};

// Regular health checks
setInterval(healthCheck, 30000); // Every 30 seconds
```

#### 3. **Graceful Degradation**
```typescript
// Fallback when Redis is unavailable
const publishWithFallback = async (channel: string, data: any) => {
  try {
    await pubSub.publish(channel, data);
  } catch (error) {
    console.error('Failed to publish to Redis:', error);
    // Could implement fallback mechanisms:
    // - Store in database for later processing
    // - Use alternative message queue
    // - Notify administrators
  }
};
```

## 📊 Redis PubSub Architecture Summary

### Key Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Separate Publisher/Subscriber** | Connection optimization, failure isolation | More complex setup |
| **Multiple Channels** | Different filtering, use cases | More channels to manage |
| **At-Least-Once Delivery** | Simplicity, performance | Potential duplicates |
| **No Message Persistence** | Performance, simplicity | Messages lost if no subscribers |
| **Best-Effort Ordering** | Performance, simplicity | No guaranteed ordering |

### Performance Characteristics

- **Latency**: Sub-millisecond message delivery
- **Throughput**: High message publishing rate
- **Scalability**: Horizontal scaling with multiple instances
- **Reliability**: Automatic reconnection and error handling

### Limitations and Mitigations

- **Message Loss**: Mitigated by automatic reconnection
- **Duplicate Messages**: Mitigated by idempotency handling
- **Ordering**: Mitigated by database timestamps
- **Persistence**: Mitigated by database storage

This Redis PubSub architecture provides an excellent foundation for multi-instance real-time communication, balancing performance, simplicity, and reliability while supporting the horizontal scaling requirements of the chat system.
