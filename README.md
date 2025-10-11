# Real-time Chat System

A scalable real-time chat system built with TypeScript, NestJS, GraphQL, PostgreSQL, Redis, and React. The system features segregated microservices architecture with multiple instances for horizontal scaling, real-time messaging, read receipts, and unread message indicators.

## 🏗️ Architecture Overview

The system implements a **segregated microservices architecture** with clear separation between read and write operations:

### Backend Services

- **User Service** (Ports 4001/4003): User account management and authentication
- **Sender Service** (Ports 4002/4004): Handles all mutations (create chat, send messages, mark as read)
- **Receiver Service** (Ports 4005/4006): Handles all queries and subscriptions (fetch data, real-time updates)
- **PostgreSQL Database**: Shared database for data persistence
- **Redis**: Message broker for real-time pub/sub across service instances

### Frontend

- **React Application** (Port 3000): Modern UI with real-time updates
- **Apollo Client**: Smart routing to appropriate backend services
- **WebSocket Subscriptions**: Real-time message delivery and status updates

## 🎯 Key Features

### Core Functionality
- ✅ **User Management**: Create, update, and manage user accounts
- ✅ **Real-time Messaging**: Instant message delivery via WebSocket
- ✅ **1:1 and Group Chats**: Support for direct and group conversations
- ✅ **Message History**: Persistent message storage and retrieval
- ✅ **Message Editing**: Edit sent messages with edit indicators
- ✅ **Message Deletion**: Remove messages with proper authorization

### Advanced Features
- ✅ **Read Receipts**: Blue/gray ticks showing message read status
- ✅ **Unread Indicators**: Blue dots with unread message counts in chat list
- ✅ **Multi-Instance Support**: Run multiple backend instances for horizontal scaling
- ✅ **Redis PubSub**: Cross-instance real-time messaging
- ✅ **Service Segregation**: Separate read and write operations for better scaling
- ✅ **Instance Selection**: UI option to manually select backend instances for testing

### User Experience
- ✅ **Responsive UI**: Modern, mobile-friendly interface
- ✅ **Real-time Updates**: No page refresh required
- ✅ **Optimistic Updates**: Instant UI feedback
- ✅ **Connection Status**: Visual indicators for connection state
- ✅ **Auto-Retry**: Automatic reconnection on connection loss

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)

### Running with Docker

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd converge
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - User Service: http://localhost:4001/graphql
   - Sender Service 1: http://localhost:4002/graphql
   - Sender Service 2: http://localhost:4004/graphql
   - Receiver Service 1: http://localhost:4005/graphql
   - Receiver Service 2: http://localhost:4006/graphql
   - Redis: localhost:6379
   - PostgreSQL: localhost:5432

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Port 3000)                      │
│  • Apollo Client with Smart Routing                             │
│  • WebSocket Subscriptions                                      │
│  • Instance Selection for Testing                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ User Service   │  │ Sender Service │  │ Receiver Service │ │
│  │ Instance 1+2   │  │ Instance 1+2   │  │ Instance 1+2     │ │
│  │ Ports 4001,    │  │ Ports 4002,    │  │ Ports 4005,      │ │
│  │       4003     │  │       4004     │  │       4006       │ │
│  │                │  │                │  │                  │ │
│  │ • User CRUD    │  │ • Create Chat  │  │ • Query Chats    │ │
│  │ • Validation   │  │ • Send Message │  │ • Query Messages │ │
│  │ • GraphQL API  │  │ • Mark Read    │  │ • Subscriptions  │ │
│  │                │  │ • Publish to   │  │ • Listen to      │ │
│  │                │  │   Redis PubSub │  │   Redis PubSub   │ │
│  └────────────────┘  └────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│  PostgreSQL Database │  │   Redis PubSub       │
│  • Users             │  │  • Real-time Events  │
│  • Chats             │  │  • Cross-Instance    │
│  • Messages          │  │  • Subscriptions     │
│  • Message Reads     │  │                      │
│  • Unread Counts     │  │                      │
└──────────────────────┘  └──────────────────────┘
```

## 📋 Database Schema

### Tables

#### Users Table
```sql
- id (UUID, Primary Key)
- username (Unique)
- email (Unique)
- display_name
- is_active (Boolean)
- created_at, updated_at
```

#### Chats Table
```sql
- id (UUID, Primary Key)
- name
- description
- chat_type (direct/group)
- participant_ids (JSONB Array)
- is_active (Boolean)
- created_at, updated_at
```

#### Messages Table
```sql
- id (UUID, Primary Key)
- content (Text)
- sender_id (String)
- chat_id (UUID, Foreign Key)
- is_edited (Boolean)
- edited_at (Timestamp, nullable)
- created_at (Timestamp)
```

#### Message Reads Table
```sql
- id (UUID, Primary Key)
- message_id (UUID, Foreign Key)
- user_id (String)
- read_at (Timestamp)
- UNIQUE(message_id, user_id)
```

#### Unread Counts Table
```sql
- id (UUID, Primary Key)
- chat_id (UUID, Foreign Key)
- user_id (String)
- unread_count (Integer)
- created_at, updated_at
- UNIQUE(chat_id, user_id)
```

## 🌐 API Endpoints

### Service Routing

The frontend automatically routes GraphQL operations to the appropriate service:

- **User Operations** → User Service (Port 4001/4003)
- **Mutations (Chat/Message)** → Sender Service (Port 4002/4004)
- **Queries/Subscriptions (Chat/Message)** → Receiver Service (Port 4005/4006)

### User Service API

**Queries:**
- `users` - Get all users
- `user(id: ID!)` - Get user by ID
- `userByUsername(username: String!)` - Get user by username

**Mutations:**
- `createUser(username, email, displayName)` - Create new user
- `updateUser(id, updateUserInput)` - Update user details
- `removeUser(id)` - Delete user account

### Sender Service API (Mutations Only)

**Chat Mutations:**
- `createChat(createChatInput)` - Create new chat
- `addParticipant(chatId, userId)` - Add user to chat
- `addParticipants(chatId, userIds)` - Add multiple users to chat
- `removeParticipant(chatId, userId)` - Remove user from chat
- `removeChat(id)` - Delete chat

**Message Mutations:**
- `createMessage(createMessageInput)` - Send new message
- `updateMessage(id, content, userId)` - Edit message
- `removeMessage(id, userId)` - Delete message
- `markMessageAsRead(messageId, userId)` - Mark message as read

### Receiver Service API (Queries & Subscriptions)

**Chat Queries:**
- `chats` - Get all chats
- `chat(id: ID!)` - Get chat by ID
- `chatsByParticipant(userId: String!)` - Get chats for user

**Message Queries:**
- `messages(chatId: ID!)` - Get messages in chat
- `message(id: ID!)` - Get message by ID
- `messageReadStatus(messageId: ID!)` - Get read receipt status
- `unreadCounts(userId: String!)` - Get unread counts for all chats
- `unreadCount(chatId: ID!, userId: String!)` - Get unread count for specific chat

**Real-time Subscriptions:**
- `messageAdded(chatId: ID!)` - New message in chat
- `messageUpdated(chatId: ID!)` - Message edited
- `messageDeleted(chatId: ID!)` - Message deleted
- `messageReadUpdated(messageId: ID!)` - Read receipt updated
- `chatAdded(userId: String!)` - New chat created for user
- `chatUpdated(userId: String!)` - Chat updated
- `unreadCountUpdated(userId: String!)` - Unread count changed

## 🧪 Testing

### Test Suite

The project includes comprehensive tests:

1. **E2E Tests** - Complete user flows across services
2. **Interactive Tests** - Browser-based testing UI
3. **Automated Tests** - GraphQL endpoint testing

### Running Tests

```bash
# Run E2E tests
npm run test:e2e

# Open interactive test suite
# Open test-realtime-messaging.html in browser

# Open automated test runner
# Open run-tests.html in browser

# Test unread indicators
# Open test-unread-indicators.html in browser
```

### Test Coverage

- ✅ User creation and management
- ✅ Chat creation (1:1 and group)
- ✅ Message sending and receiving
- ✅ Real-time message delivery
- ✅ Read receipts functionality
- ✅ Unread message indicators
- ✅ Multi-instance message propagation
- ✅ Cross-instance real-time updates

## 🔧 Development

### Local Development Setup

1. **Install dependencies:**
   ```bash
   # Backend services
   cd backend/user-service && npm install
   cd ../sender-service && npm install
   cd ../receiver-service && npm install
   
   # Frontend
   cd ../../frontend && npm install
   ```

2. **Start PostgreSQL and Redis:**
   ```bash
   docker-compose up postgres redis
   ```

3. **Start services in development mode:**
   ```bash
   # Terminal 1 - User Service
   cd backend/user-service && npm run start:dev
   
   # Terminal 2 - Sender Service
   cd backend/sender-service && npm run start:dev
   
   # Terminal 3 - Receiver Service
   cd backend/receiver-service && npm run start:dev
   
   # Terminal 4 - Frontend
   cd frontend && npm start
   ```

### Development Features

- **Hot Reload**: Backend services restart automatically on code changes
- **Live Reload**: Frontend updates instantly
- **Volume Mounting**: Source code mounted for real-time updates
- **Fast Iteration**: Changes appear in ~2-3 seconds

## 📈 Scalability Features

### Horizontal Scaling

**Multiple Service Instances:**
- Each service runs 2 instances by default
- Load can be distributed across instances
- Independent scaling per service type

**Redis PubSub:**
- Enables cross-instance communication
- All instances share the same message bus
- True multi-instance real-time messaging

**Database Optimization:**
- Connection pooling for efficient resource usage
- Proper indexing on frequently queried fields
- Read replicas can be added for read-heavy loads

### Service Segregation Benefits

**Sender Service (Write Operations):**
- Optimized for write performance
- Can scale independently based on write load
- Handles all mutations and publishes to Redis

**Receiver Service (Read Operations):**
- Optimized for read performance and subscriptions
- Can scale independently based on read load
- Handles all queries and listens to Redis

**Independent Scaling:**
- Scale sender services for high write loads
- Scale receiver services for high read loads
- Optimize resources based on actual usage patterns

## 🎨 Frontend Features

### Smart Routing

The Apollo Client automatically routes operations to the correct service based on the operation type:

```typescript
// Mutations go to Sender Service
const [createMessage] = useMutation(CREATE_MESSAGE);

// Queries go to Receiver Service
const { data } = useQuery(GET_MESSAGES);

// Subscriptions go to Receiver Service
useSubscription(MESSAGE_ADDED);
```

### Instance Selection

For testing and debugging, users can manually select which backend instance to connect to:

- **Sender Instance**: Choose between Instance 1 (4002) or Instance 2 (4004)
- **Receiver Instance**: Choose between Instance 1 (4005) or Instance 2 (4006)

### Real-time Features

- **Instant Message Delivery**: Messages appear immediately via WebSocket
- **Read Receipts**: Blue ticks when all users have read the message
- **Unread Indicators**: Blue dots with counts for chats with unread messages
- **Automatic Read Tracking**: Messages marked as read when viewed
- **Connection Status**: Visual indicators for connection state

## 🔒 Security Considerations

### Authorization

- **Message Ownership**: Only senders can edit/delete their messages
- **Chat Participation**: Users can only access chats they're part of
- **Read Receipts**: Only participants can mark messages as read

### Input Validation

- **Class Validators**: Input validation on all mutations
- **GraphQL Type Safety**: Strong typing prevents invalid data
- **SQL Injection Prevention**: TypeORM parameterized queries

### CORS Configuration

- Configured for local development (ports 3000-3001)
- Should be restricted in production

## 🐳 Docker Configuration

### Services

```yaml
# PostgreSQL Database
postgres:
  image: postgres:15
  ports: 5432:5432
  
# Redis PubSub
redis:
  image: redis:7-alpine
  ports: 6379:6379

# User Services (2 instances)
user-service-1: port 4001
user-service-2: port 4003

# Sender Services (2 instances)
sender-service-1: port 4002
sender-service-2: port 4004

# Receiver Services (2 instances)
receiver-service-1: port 4005
receiver-service-2: port 4006

# Frontend
frontend: port 3000
```

### Health Checks

All services include health checks for container orchestration and monitoring.

## 📚 Documentation

- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** - Detailed API documentation with examples
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design decisions
- **[TESTING.md](./TESTING.md)** - Comprehensive testing guide
- **[UNREAD_INDICATOR_FEATURE.md](./UNREAD_INDICATOR_FEATURE.md)** - Unread indicator implementation details
- **[MULTI_INSTANCE_IMPLEMENTATION.md](./MULTI_INSTANCE_IMPLEMENTATION.md)** - Multi-instance setup guide

## 🚀 Production Deployment

### Environment Variables

```bash
# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_NAME=chat_system

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Service Ports
PORT=4001  # or 4002, 4005, etc.
NODE_ENV=production
```

### Deployment Checklist

1. ✅ Configure environment variables
2. ✅ Enable HTTPS/TLS
3. ✅ Set up database backups
4. ✅ Configure load balancer
5. ✅ Set up monitoring and alerting
6. ✅ Implement rate limiting
7. ✅ Configure CORS for production domains
8. ✅ Set up logging aggregation

## 🔮 Future Enhancements

### Planned Features

1. **Authentication**: JWT-based authentication with refresh tokens
2. **File Sharing**: Support for image and file attachments
3. **Push Notifications**: Browser and mobile push notifications
4. **Message Reactions**: Emoji reactions to messages
5. **User Presence**: Online/offline status indicators
6. **Message Search**: Full-text search across message history
7. **Voice/Video Calls**: WebRTC integration
8. **Message Threading**: Reply to specific messages

### Technical Improvements

1. **API Gateway**: Centralized routing and rate limiting
2. **Service Mesh**: Advanced service communication
3. **Message Archiving**: Archive old messages to reduce database size
4. **CDN Integration**: Static asset delivery via CDN
5. **Advanced Monitoring**: Prometheus/Grafana integration
6. **Database Sharding**: Horizontal database scaling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **NestJS**: Excellent framework for scalable Node.js applications
- **Apollo GraphQL**: Powerful GraphQL client and server tools
- **TypeORM**: Feature-rich ORM for TypeScript
- **React**: Modern UI library
- **Docker**: Containerization platform
- **Redis**: In-memory data store for pub/sub

---

**Built with** ❤️ **using modern technologies and best practices for scalable real-time applications.**
