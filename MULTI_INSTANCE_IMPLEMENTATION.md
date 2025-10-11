# Multi-Instance Redis Architecture Implementation

## Overview
This document describes the implementation of a scalable multi-instance architecture for the real-time chat application with Redis PubSub, service segregation, and read receipts functionality.

## Architecture Changes

### 1. Infrastructure Updates

#### Redis Integration
- **Added Redis service** to `docker-compose.yml` (port 6379)
- Redis acts as a centralized message broker for all backend instances
- Enables true multi-instance real-time messaging

#### Database Schema
- **New table: `message_reads`**
  - Fields: `id`, `message_id`, `user_id`, `read_at`
  - Tracks which users have read which messages
  - Supports read receipts functionality

### 2. Service Segregation

The original `chat-service` has been split into two specialized services:

#### Sender Service (Ports: 4002, 4004)
**Responsibilities:**
- Handles all mutations (write operations)
- Mutations: `createChat`, `addParticipants`, `createMessage`, `updateMessage`, `deleteMessage`, `markMessageAsRead`
- Publishes events to Redis PubSub
- No queries or subscriptions

**Key Files:**
- `backend/sender-service/src/chat/chat.service.ts` - Uses Redis PubSub
- `backend/sender-service/src/message/message.service.ts` - Includes `markMessageAsRead` method
- `backend/sender-service/src/common/redis-pubsub.provider.ts` - Redis connection

#### Receiver Service (Ports: 4005, 4006)
**Responsibilities:**
- Handles all queries (read operations)
- Queries: `chats`, `chat`, `chatsByParticipant`, `messages`, `message`, `messageReadStatus`
- Handles all subscriptions (WebSocket connections)
- Subscriptions: `messageAdded`, `messageUpdated`, `messageDeleted`, `chatAdded`, `chatUpdated`, `messageReadUpdated`
- Subscribes to Redis PubSub and pushes updates to clients

**Key Files:**
- `backend/receiver-service/src/chat/chat.service.ts` - Uses Redis PubSub
- `backend/receiver-service/src/message/message.service.ts` - Includes `getMessageReadStatus` method
- `backend/receiver-service/src/common/redis-pubsub.provider.ts` - Redis connection

### 3. Frontend Updates

#### Apollo Client Routing
**File:** `frontend/src/apollo/client.ts`

The Apollo client now intelligently routes operations:
- **User operations** → User Service (port 4001)
- **Chat/Message mutations** → Sender Service (configurable: 4002 or 4004)
- **Chat/Message queries** → Receiver Service (configurable: 4005 or 4006)
- **Subscriptions** → Receiver Service (WebSocket)

Dynamic instance selection from localStorage allows runtime switching.

#### Instance Selector Component
**File:** `frontend/src/components/InstanceSelector.tsx`

- Dropdown UI to select sender and receiver instances
- Stores selection in localStorage
- Reloads page to reconnect with new instances
- Shows current connected instances

#### Read Receipt Indicator Component
**File:** `frontend/src/components/ReadReceiptIndicator.tsx`

- Shows blue double-tick (✓✓) when all participants have read the message
- Shows gray double-tick (✓✓) when not all participants have read
- Only visible on messages sent by current user
- Real-time updates via GraphQL subscription

#### Auto-Mark Messages as Read
**Updated:** `frontend/src/components/ChatWindow.tsx`

- Automatically marks messages as read when viewing a chat
- Only marks messages sent by other users
- Avoids duplicate marking with local state tracking
- Triggers read receipt updates via mutation

### 4. GraphQL Schema Updates

#### New Queries
```graphql
messageReadStatus(messageId: ID!): MessageReadStatus
```
Returns:
- `messageId`
- `totalParticipants` (excluding sender)
- `readByCount`
- `isFullyRead` (boolean for tick color)
- `readByUsers` (array with userId and readAt)

#### New Mutations
```graphql
markMessageAsRead(messageId: ID!, userId: String!): MessageRead
```

#### New Subscriptions
```graphql
messageReadUpdated(messageId: ID!): MessageReadUpdate
```

## How Multi-Instance Messaging Works

### Scenario: UserA, UserB, UserC on different instances

1. **UserA sends message**
   - Frontend → Sender Service (e.g., sender-service-1 on port 4002)
   
2. **Sender saves and publishes**
   - Saves message to PostgreSQL
   - Publishes `messageAdded` event to **Redis**
   
3. **Redis broadcasts**
   - All receiver instances (receiver-service-1 and receiver-service-2) receive the event
   
4. **Receivers push to clients**
   - receiver-service-1 → Pushes to UserB (if connected)
   - receiver-service-2 → Pushes to UserC (if connected)
   
5. **Result**: All users see the message in real-time, regardless of which instance they're connected to! ✅

## Docker Services

### Updated docker-compose.yml

**Services:**
- `redis` - Redis 7 Alpine (port 6379)
- `postgres` - PostgreSQL 15 (port 5432)
- `user-service-1` - Port 4001
- `user-service-2` - Port 4003
- `sender-service-1` - Port 4002
- `sender-service-2` - Port 4004
- `receiver-service-1` - Port 4005
- `receiver-service-2` - Port 4006
- `frontend` - Port 3000

**Environment Variables:**
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- Database connection details

## Testing Multi-Instance Setup

### Step 1: Start Services
```bash
docker-compose up --build
```

### Step 2: Create Users
Create 3 users (UserA, UserB, UserC) from the login screen.

### Step 3: Select Different Instances

**UserA:**
- Sender: Instance 1 (Port 4002)
- Receiver: Instance 1 (Port 4005)

**UserB:**
- Sender: Instance 1 (Port 4002)
- Receiver: Instance 2 (Port 4006)

**UserC:**
- Sender: Instance 2 (Port 4004)
- Receiver: Instance 1 (Port 4005)

### Step 4: Create Group Chat
UserA creates a group chat and adds UserB and UserC.

### Step 5: Test Messaging
1. UserA sends a message → UserB and UserC should receive it instantly
2. UserC sends a message → UserA and UserB should receive it instantly
3. Verify messages show gray ticks initially, then turn blue when all users have viewed the chat

### Step 6: Test Read Receipts
1. UserA sends a message
2. UserA sees gray double-tick
3. UserB opens the chat (message auto-marked as read)
4. UserC opens the chat (message auto-marked as read)
5. UserA sees blue double-tick (all participants have read)

### Step 7: Test Instance Switching
1. UserB switches Receiver to Instance 1 (from dropdown)
2. Page reloads
3. UserB should still receive messages from UserA and UserC
4. Verify WebSocket connection is maintained

## Key Benefits

1. **Horizontal Scalability**: Can add more sender/receiver instances as load increases
2. **Load Distribution**: Users can be distributed across multiple receiver instances
3. **High Availability**: If one instance fails, others continue serving
4. **Separation of Concerns**: Write and read operations are isolated
5. **Real-Time Sync**: Redis ensures all instances stay synchronized
6. **Read Receipts**: Users know when their messages have been seen

## Technical Details

### Redis PubSub Channels
- `chatAdded`
- `chatUpdated`
- `messageAdded`
- `messageUpdated`
- `messageDeleted`
- `messageReadUpdated`
- `chatMessageNotification`
- `messageUpdateForChatList`

### Database Indexes
- `idx_message_reads_message_id` - Fast lookup by message
- `idx_message_reads_user_id` - Fast lookup by user

### Dependencies Added
- `graphql-redis-subscriptions: ^2.6.0`
- `ioredis: ^5.3.2`

## Files Created/Modified

### Created
- `backend/sender-service/` (entire service)
- `backend/receiver-service/` (entire service)
- `backend/sender-service/src/common/redis-pubsub.provider.ts`
- `backend/receiver-service/src/common/redis-pubsub.provider.ts`
- `backend/sender-service/src/message/entities/message-read.entity.ts`
- `backend/receiver-service/src/message/entities/message-read.entity.ts`
- `backend/receiver-service/src/message/dto/message-read-status.dto.ts`
- `backend/receiver-service/src/message/dto/message-read-update.dto.ts`
- `frontend/src/components/InstanceSelector.tsx`
- `frontend/src/components/ReadReceiptIndicator.tsx`

### Modified
- `docker-compose.yml` - Added Redis, sender/receiver services
- `init-db.sql` - Added message_reads table
- `frontend/src/apollo/client.ts` - Dynamic routing logic
- `frontend/src/graphql/queries.ts` - Added read receipt operations
- `frontend/src/components/ChatApp.tsx` - Added InstanceSelector
- `frontend/src/components/ChatWindow.tsx` - Added read receipts and auto-mark logic

## Future Enhancements

1. **Load Balancer**: Add nginx/HAProxy to distribute load automatically
2. **Redis Cluster**: For high availability Redis setup
3. **Metrics**: Add monitoring for instance health and message throughput
4. **Delivery Status**: Add "delivered" status (gray single tick) before "read"
5. **Typing Indicators**: Show when users are typing using Redis PubSub
6. **Presence**: Show online/offline status using Redis

