# Detailed Application Flows Documentation

## 🏗️ System Architecture Overview

### Service Ports and Responsibilities

| Service | Instance | Port | Primary Responsibility |
|---------|----------|------|----------------------|
| **User Service** | Instance 1 | 4001 | User CRUD operations, authentication |
| **User Service** | Instance 2 | 4003 | User CRUD operations, authentication |
| **Sender Service** | Instance 1 | 4002 | All mutations (create, update, delete) |
| **Sender Service** | Instance 2 | 4004 | All mutations (create, update, delete) |
| **Receiver Service** | Instance 1 | 4005 | Queries and subscriptions |
| **Receiver Service** | Instance 2 | 4006 | Queries and subscriptions |
| **Frontend** | Single | 3000 | React UI with Apollo Client |
| **PostgreSQL** | Single | 5432 | Data persistence |
| **Redis** | Single | 6379 | PubSub message broker |

### Multi-Instance Architecture Diagram

```
Frontend (Port 3000)
    │
    ├── Apollo Client Smart Routing
    │
    ├── User Operations → User Service (4001/4003)
    │
    ├── Mutations → Sender Service (4002/4004)
    │   ├── Create Chat
    │   ├── Send Message
    │   ├── Mark as Read
    │   └── Update/Delete Message
    │
    └── Queries/Subscriptions → Receiver Service (4005/4006)
        ├── Get Chats
        ├── Get Messages
        ├── Real-time Subscriptions
        └── Read Receipts

Redis PubSub Channels:
├── messageAdded
├── messageUpdated
├── messageDeleted
├── chatAdded
├── chatUpdated
├── messageReadUpdated
├── unreadCountUpdated
├── chatMessageNotification
└── messageUpdateForChatList
```

---

## 🔐 User Management Flows

### Flow 1: User Registration/Login

**Purpose**: Create new user or authenticate existing user

#### Entry Point
- **UI Component**: `frontend/src/components/Login.tsx`
- **Trigger**: User submits login form
- **Entry Function**: `handleSubmit()` (line 33)

#### Frontend Processing
1. **Form Submission**: `Login.tsx` → `handleSubmit()`
2. **Apollo Client Routing**: `frontend/src/apollo/client.ts`
   - Operation type: Mutation (`CREATE_USER`)
   - Routes to: User Service (Port 4001)
   - File: `isChatMessageOperation()` returns `false` → routes to user service

#### Backend Service
- **Service**: User Service (Port 4001)
- **Resolver**: `backend/user-service/src/user/user.resolver.ts`
- **Method**: `createUser()` mutation

#### Service Processing
1. **Resolver**: `user.resolver.ts` → `createUser()` (line 15)
2. **Service**: `backend/user-service/src/user/user.service.ts`
   - `create()` method (line 15)
   - Username uniqueness check (line 17-22)
   - Email uniqueness check (line 25-32)
   - User creation and save (line 34-35)

#### Database Operations
- **Repository**: `backend/user-service/src/user/entities/user.entity.ts`
- **Operations**: 
  - Find existing username (line 17)
  - Find existing email (line 26)
  - Save new user (line 35)
- **Table**: `users`

#### Exit Point
- **Success**: User stored in localStorage, redirect to `/chat`
- **Error**: Display error message in UI
- **File**: `Login.tsx` → `setSession()` → `navigate('/chat')`

#### File References
```
frontend/src/components/Login.tsx
frontend/src/apollo/client.ts
frontend/src/utils/session.ts
backend/user-service/src/user/user.resolver.ts
backend/user-service/src/user/user.service.ts
backend/user-service/src/user/entities/user.entity.ts
backend/user-service/src/user/dto/create-user.input.ts
```

---

### Flow 2: User Lookup Flow

**Purpose**: Find existing user by username or email

#### Entry Point
- **UI Component**: `frontend/src/components/Login.tsx`
- **Trigger**: User creation fails with "already exists" error
- **Entry Function**: `handleSubmit()` → catch block (line 62)

#### Frontend Processing
1. **Error Handling**: `Login.tsx` → catch block for user creation
2. **User Search**: Query `GET_USERS` to find existing user
3. **Apollo Client Routing**: Routes to User Service (Port 4001)

#### Backend Service
- **Service**: User Service (Port 4001)
- **Resolver**: `backend/user-service/src/user/user.resolver.ts`
- **Method**: `users` query

#### Service Processing
1. **Resolver**: `user.resolver.ts` → `findAll()` (line 9)
2. **Service**: `backend/user-service/src/user/user.service.ts`
   - `findAll()` method (line 38)
   - Filter active users only (line 40)

#### Database Operations
- **Repository**: User entity repository
- **Operations**: Find all active users
- **Table**: `users` (WHERE isActive = true)

#### Exit Point
- **Success**: User found, stored in localStorage, redirect to `/chat`
- **Failure**: Display "User already exists but could not be found" error

#### File References
```
frontend/src/components/Login.tsx
frontend/src/graphql/queries.ts (GET_USERS)
backend/user-service/src/user/user.resolver.ts
backend/user-service/src/user/user.service.ts
```

---

## 💬 Chat Management Flows

### Flow 3: Create Chat Flow

**Purpose**: Create new chat (direct or group)

#### Entry Point
- **UI Component**: `frontend/src/components/ChatApp.tsx`
- **Trigger**: User clicks "Create New Chat" → fills form
- **Entry Function**: `handleCreateChat()` (line 179)

#### Frontend Processing
1. **Form Submission**: `ChatApp.tsx` → `handleCreateChat()`
2. **Apollo Client Routing**: `frontend/src/apollo/client.ts`
   - Operation type: Mutation (`CREATE_CHAT`)
   - Routes to: Sender Service (Port 4002/4004)
   - File: `isChatMessageOperation()` returns `true` + `isMutation()` returns `true`

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/chat/chat.resolver.ts`
- **Method**: `createChat()` mutation (line 12)

#### Service Processing
1. **Resolver**: `chat.resolver.ts` → `createChat()` (line 12)
2. **Service**: `backend/sender-service/src/chat/chat.service.ts`
   - `create()` method (line 15)
   - Chat entity creation (line 16)
   - Database save (line 17)
   - Redis PubSub publish (line 20-22)

#### Database Operations
- **Repository**: `backend/sender-service/src/chat/entities/chat.entity.ts`
- **Operations**: Save new chat entity
- **Table**: `chats`

#### Redis PubSub
- **Channel**: `chatAdded`
- **Publisher**: `backend/sender-service/src/common/redis-pubsub.provider.ts`
- **Payload**: Complete chat object

#### Real-time Propagation
1. **Redis**: Broadcasts to all receiver service instances
2. **Receiver Service**: `backend/receiver-service/src/chat/chat.resolver.ts`
   - `chatAdded` subscription (line 29)
   - Filter by participant (line 26)
3. **Frontend**: `ChatApp.tsx` → `CHAT_ADDED` subscription (line 96)

#### Exit Point
- **Success**: New chat appears in chat list, auto-selected
- **UI Update**: `refetchChats()` called, `setSelectedChatId()`
- **File**: `ChatApp.tsx` → `onCompleted` callback (line 55)

#### File References
```
frontend/src/components/ChatApp.tsx
frontend/src/components/CreateChatForm.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (CREATE_CHAT)
backend/sender-service/src/chat/chat.resolver.ts
backend/sender-service/src/chat/chat.service.ts
backend/sender-service/src/chat/entities/chat.entity.ts
backend/sender-service/src/common/redis-pubsub.provider.ts
backend/receiver-service/src/chat/chat.resolver.ts
```

---

### Flow 4: Get User Chats Flow

**Purpose**: Retrieve all chats for a specific user

#### Entry Point
- **UI Component**: `frontend/src/components/ChatApp.tsx`
- **Trigger**: Component mount or user login
- **Entry Function**: `useQuery(GET_CHATS_BY_PARTICIPANT)` (line 16)

#### Frontend Processing
1. **Query Initiation**: `ChatApp.tsx` → `useQuery` hook
2. **Apollo Client Routing**: `frontend/src/apollo/client.ts`
   - Operation type: Query (`GET_CHATS_BY_PARTICIPANT`)
   - Routes to: Receiver Service (Port 4005/4006)
   - File: `isChatMessageOperation()` returns `true` + not mutation

#### Backend Service
- **Service**: Receiver Service (Port 4005 or 4006)
- **Resolver**: `backend/receiver-service/src/chat/chat.resolver.ts`
- **Method**: `chatsByParticipant` query (line 19)

#### Service Processing
1. **Resolver**: `chat.resolver.ts` → `findByParticipant()` (line 20)
2. **Service**: `backend/receiver-service/src/chat/chat.service.ts`
   - `findByParticipant()` method (line 39)
   - Complex query with JSONB participant filtering (line 43)
   - Join with messages (line 44)

#### Database Operations
- **Repository**: Chat entity repository
- **Operations**: 
  - Query: `chat.participantIds @> :userId` (JSONB contains)
  - Join: `leftJoinAndSelect('chat.messages', 'messages')`
  - Order: By `chat.updatedAt DESC`, `messages.createdAt DESC`
- **Table**: `chats` JOIN `messages`

#### Exit Point
- **Success**: Chat list populated in `ChatList.tsx`
- **UI Update**: `chatsData?.chatsByParticipant` displayed
- **File**: `ChatApp.tsx` → `ChatList` component (line 285)

#### File References
```
frontend/src/components/ChatApp.tsx
frontend/src/components/ChatList.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (GET_CHATS_BY_PARTICIPANT)
backend/receiver-service/src/chat/chat.resolver.ts
backend/receiver-service/src/chat/chat.service.ts
backend/receiver-service/src/chat/entities/chat.entity.ts
```

---

### Flow 5: Add Participants Flow

**Purpose**: Add users to existing chat

#### Entry Point
- **UI Component**: `frontend/src/components/AddUsersModal.tsx`
- **Trigger**: User clicks "Add Users" in group chat
- **Entry Function**: `handleAddUsers()` in modal

#### Frontend Processing
1. **Modal Submission**: `AddUsersModal.tsx` → user selection
2. **Mutation Call**: `ChatApp.tsx` → `addParticipants` mutation (line 65)
3. **Apollo Client Routing**: Routes to Sender Service (Port 4002/4004)

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/chat/chat.resolver.ts`
- **Method**: `addParticipants` mutation (line 24)

#### Service Processing
1. **Resolver**: `chat.resolver.ts` → `addParticipants()` (line 28)
2. **Service**: `backend/sender-service/src/chat/chat.service.ts`
   - `addParticipants()` method (line 72)
   - Filter new participants (line 75)
   - Update participant array (line 77)
   - Save updated chat (line 78)
   - Redis PubSub publish (line 81-83)

#### Database Operations
- **Repository**: Chat entity repository
- **Operations**: Update `participantIds` JSONB array
- **Table**: `chats`

#### Redis PubSub
- **Channel**: `chatUpdated`
- **Publisher**: Sender service
- **Payload**: Updated chat object

#### Real-time Propagation
1. **Redis**: Broadcasts chat update
2. **Receiver Service**: `chatUpdated` subscription
3. **Frontend**: `ChatApp.tsx` → `CHAT_UPDATED` subscription (line 109)

#### Exit Point
- **Success**: New participants appear in chat
- **UI Update**: `refetchChats()` called
- **File**: `ChatApp.tsx` → `onCompleted` callback (line 66)

#### File References
```
frontend/src/components/AddUsersModal.tsx
frontend/src/components/ChatApp.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (ADD_PARTICIPANTS)
backend/sender-service/src/chat/chat.resolver.ts
backend/sender-service/src/chat/chat.service.ts
backend/receiver-service/src/chat/chat.resolver.ts
```

---

## 📨 Messaging Flows

### Flow 6: Send Message Flow (Multi-Instance Propagation)

**Purpose**: Send message with real-time delivery to all participants

#### Entry Point
- **UI Component**: `frontend/src/components/ChatWindow.tsx`
- **Trigger**: User submits message form
- **Entry Function**: `handleSubmit()` (line 91)

#### Frontend Processing
1. **Form Submission**: `ChatWindow.tsx` → `handleSubmit()`
2. **Parent Call**: `ChatApp.tsx` → `handleSendMessage()` (line 196)
3. **Apollo Client Routing**: `frontend/src/apollo/client.ts`
   - Operation type: Mutation (`CREATE_MESSAGE`)
   - Routes to: Sender Service (Port 4002/4004)

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/message/message.resolver.ts`
- **Method**: `createMessage` mutation (line 13)

#### Service Processing
1. **Resolver**: `message.resolver.ts` → `createMessage()` (line 13)
2. **Service**: `backend/sender-service/src/message/message.service.ts`
   - `create()` method (line 22)
   - Participant validation (line 24-31)
   - Message creation (line 33-34)
   - **Multiple Redis PubSub publishes**:
     - `messageAdded` (line 37-39)
     - `chatMessageNotification` (line 43-49)
     - `messageUpdateForChatList` (line 52-58)
   - Unread count increment for all participants (line 61-66)

#### Database Operations
- **Repository**: Message entity repository
- **Operations**: 
  - Save new message
  - Increment unread counts for all participants except sender
- **Tables**: `messages`, `unread_counts`

#### Redis PubSub (Multiple Channels)
1. **`messageAdded`**: Direct message to chat subscribers
2. **`chatMessageNotification`**: General notification to all participants
3. **`messageUpdateForChatList`**: Update chat list for all users

#### Multi-Instance Propagation
1. **Redis**: Broadcasts to ALL receiver service instances
2. **Receiver Service 1** (Port 4005): Receives events
3. **Receiver Service 2** (Port 4006): Receives events
4. **WebSocket Subscriptions**: Each receiver pushes to connected clients

#### Real-time Propagation
1. **Frontend Subscriptions** in `ChatApp.tsx`:
   - `MESSAGE_ADDED` subscription (line 79)
   - `CHAT_MESSAGE_NOTIFICATION` subscription (line 123)
   - `MESSAGE_UPDATE_FOR_CHAT_LIST` subscription (line 137)
2. **UI Updates**: `refetchMessages()` and `refetchChats()` called

#### Exit Point
- **Success**: Message appears instantly in all participant UIs
- **UI Update**: Message displayed, chat list updated
- **File**: `ChatWindow.tsx` → message added to list

#### File References
```
frontend/src/components/ChatWindow.tsx
frontend/src/components/ChatApp.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (CREATE_MESSAGE, MESSAGE_ADDED)
backend/sender-service/src/message/message.resolver.ts
backend/sender-service/src/message/message.service.ts
backend/sender-service/src/message/entities/message.entity.ts
backend/sender-service/src/chat/unread-count.service.ts
backend/sender-service/src/common/redis-pubsub.provider.ts
backend/receiver-service/src/message/message.resolver.ts
backend/receiver-service/src/chat/unread-count.resolver.ts
```

---

### Flow 7: Receive Message Flow (Real-time Subscription)

**Purpose**: Receive messages in real-time via WebSocket subscriptions

#### Entry Point
- **UI Component**: `frontend/src/components/ChatApp.tsx`
- **Trigger**: WebSocket connection established
- **Entry Function**: `useSubscription(MESSAGE_ADDED)` (line 79)

#### Frontend Processing
1. **Subscription Setup**: `ChatApp.tsx` → `useSubscription` hook
2. **Apollo Client**: WebSocket connection to Receiver Service
3. **Routing**: `frontend/src/apollo/client.ts` → `splitLink` → WebSocket

#### WebSocket Connection
- **URL**: `ws://localhost:${receiverPort}/graphql`
- **Service**: Receiver Service (Port 4005 or 4006)
- **Connection Params**: User ID and username from localStorage

#### Backend Service
- **Service**: Receiver Service (Port 4005 or 4006)
- **Resolver**: `backend/receiver-service/src/message/message.resolver.ts`
- **Method**: `messageAdded` subscription (line 31)

#### Service Processing
1. **Subscription**: `message.resolver.ts` → `messageAdded()` (line 31)
2. **Filter**: Only messages for selected chat (line 28)
3. **Async Iterator**: Returns Redis PubSub async iterator

#### Redis PubSub
- **Channel**: `messageAdded`
- **Listener**: Receiver service listens for published messages
- **Filter**: Chat ID matching

#### Real-time Processing
1. **Message Received**: Redis event triggers subscription
2. **WebSocket Push**: Receiver service pushes to connected clients
3. **Frontend Handler**: `onData` callback (line 82)
4. **UI Update**: `refetchMessages()` called (line 87)

#### Exit Point
- **Success**: New message appears in chat window
- **UI Update**: Message list updated, scroll to bottom
- **File**: `ChatWindow.tsx` → message rendered

#### File References
```
frontend/src/components/ChatApp.tsx
frontend/src/components/ChatWindow.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (MESSAGE_ADDED)
backend/receiver-service/src/message/message.resolver.ts
backend/receiver-service/src/common/redis-pubsub.provider.ts
```

---

### Flow 8: Message Update Flow

**Purpose**: Edit existing message with real-time updates

#### Entry Point
- **UI Component**: Message edit interface (not implemented in current UI)
- **Trigger**: User edits message
- **Entry Function**: `updateMessage` mutation

#### Frontend Processing
1. **Mutation Call**: Apollo Client mutation
2. **Apollo Client Routing**: Routes to Sender Service (Port 4002/4004)

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/message/message.resolver.ts`
- **Method**: `updateMessage` mutation (line 18)

#### Service Processing
1. **Resolver**: `message.resolver.ts` → `updateMessage()` (line 18)
2. **Service**: `backend/sender-service/src/message/message.service.ts`
   - `update()` method (line 94)
   - Authorization check (sender only) (line 98-100)
   - Update content and edit flags (line 102-104)
   - Save updated message (line 106)
   - Redis PubSub publish (line 109-111)

#### Database Operations
- **Repository**: Message entity repository
- **Operations**: Update message content, `isEdited`, `editedAt`
- **Table**: `messages`

#### Redis PubSub
- **Channel**: `messageUpdated`
- **Publisher**: Sender service
- **Payload**: Updated message object

#### Real-time Propagation
1. **Redis**: Broadcasts to receiver services
2. **Frontend**: `MESSAGE_UPDATED` subscription
3. **UI Update**: Message content updated, "(edited)" indicator shown

#### Exit Point
- **Success**: Updated message displayed with edit indicator
- **UI Update**: Message content changed, edit timestamp shown

#### File References
```
frontend/src/graphql/queries.ts (UPDATE_MESSAGE, MESSAGE_UPDATED)
backend/sender-service/src/message/message.resolver.ts
backend/sender-service/src/message/message.service.ts
backend/receiver-service/src/message/message.resolver.ts
```

---

### Flow 9: Message Delete Flow

**Purpose**: Delete message with real-time updates

#### Entry Point
- **UI Component**: Message delete interface (not implemented in current UI)
- **Trigger**: User deletes message
- **Entry Function**: `removeMessage` mutation

#### Frontend Processing
1. **Mutation Call**: Apollo Client mutation
2. **Apollo Client Routing**: Routes to Sender Service (Port 4002/4004)

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/message/message.resolver.ts`
- **Method**: `removeMessage` mutation (line 27)

#### Service Processing
1. **Resolver**: `message.resolver.ts` → `removeMessage()` (line 27)
2. **Service**: `backend/sender-service/src/message/message.service.ts`
   - `remove()` method (line 116)
   - Authorization check (sender only) (line 120-122)
   - Remove from database (line 124)
   - Redis PubSub publish (line 127-129)

#### Database Operations
- **Repository**: Message entity repository
- **Operations**: Delete message record
- **Table**: `messages`

#### Redis PubSub
- **Channel**: `messageDeleted`
- **Publisher**: Sender service
- **Payload**: Message ID and chat ID

#### Real-time Propagation
1. **Redis**: Broadcasts to receiver services
2. **Frontend**: `MESSAGE_DELETED` subscription
3. **UI Update**: Message removed from chat

#### Exit Point
- **Success**: Message removed from all participant UIs
- **UI Update**: Message no longer visible

#### File References
```
frontend/src/graphql/queries.ts (DELETE_MESSAGE, MESSAGE_DELETED)
backend/sender-service/src/message/message.resolver.ts
backend/sender-service/src/message/message.service.ts
backend/receiver-service/src/message/message.resolver.ts
```

---

## ✅ Read Receipt Flows

### Flow 10: Mark Message as Read Flow

**Purpose**: Mark message as read when user views chat

#### Entry Point
- **UI Component**: `frontend/src/components/ChatWindow.tsx`
- **Trigger**: User opens chat with unread messages
- **Entry Function**: `useEffect` hook (line 62)

#### Frontend Processing
1. **Auto-Mark Logic**: `ChatWindow.tsx` → `useEffect` (line 62)
2. **Condition Check**: Only if unread count > 0 (line 67)
3. **Message Loop**: For each unread message not sent by user (line 70)
4. **Mutation Call**: `markMessageAsRead` mutation (line 77)

#### Apollo Client Routing
- **Operation Type**: Mutation (`MARK_MESSAGE_AS_READ`)
- **Routes to**: Sender Service (Port 4002/4004)

#### Backend Service
- **Service**: Sender Service (Port 4002 or 4004)
- **Resolver**: `backend/sender-service/src/message/message.resolver.ts`
- **Method**: `markMessageAsRead` mutation (line 34)

#### Service Processing
1. **Resolver**: `message.resolver.ts` → `markMessageAsRead()` (line 34)
2. **Service**: `backend/sender-service/src/message/message.service.ts`
   - `markMessageAsRead()` method (line 134)
   - Message existence check (line 136)
   - Participant validation (line 139-142)
   - Duplicate read check (line 145-151)
   - Create read receipt (line 154-155)
   - Reset unread count if needed (line 160-164)
   - Redis PubSub publish (line 167-173)

#### Database Operations
- **Repository**: MessageRead entity repository
- **Operations**: 
  - Create `message_reads` record
  - Reset `unread_counts` to 0
- **Tables**: `message_reads`, `unread_counts`

#### Redis PubSub
- **Channel**: `messageReadUpdated`
- **Publisher**: Sender service
- **Payload**: Message ID, user ID, read timestamp

#### Real-time Propagation
1. **Redis**: Broadcasts to receiver services
2. **Frontend**: `MESSAGE_READ_UPDATED` subscription
3. **UI Update**: Read receipt indicators updated

#### Exit Point
- **Success**: Message marked as read, unread count reset
- **UI Update**: Blue dot removed, read receipts updated
- **File**: `ChatWindow.tsx` → `markedAsRead` state updated

#### File References
```
frontend/src/components/ChatWindow.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (MARK_MESSAGE_AS_READ)
backend/sender-service/src/message/message.resolver.ts
backend/sender-service/src/message/message.service.ts
backend/sender-service/src/message/entities/message-read.entity.ts
backend/sender-service/src/chat/unread-count.service.ts
backend/receiver-service/src/message/message.resolver.ts
```

---

### Flow 11: Read Status Query Flow

**Purpose**: Get read receipt status for message

#### Entry Point
- **UI Component**: `frontend/src/components/ReadReceiptIndicator.tsx`
- **Trigger**: Component mounts for each message
- **Entry Function**: `useQuery(GET_MESSAGE_READ_STATUS)`

#### Frontend Processing
1. **Query Initiation**: `ReadReceiptIndicator.tsx` → `useQuery`
2. **Apollo Client Routing**: Routes to Receiver Service (Port 4005/4006)

#### Backend Service
- **Service**: Receiver Service (Port 4005 or 4006)
- **Resolver**: `backend/receiver-service/src/message/message.resolver.ts`
- **Method**: `messageReadStatus` query (line 21)

#### Service Processing
1. **Resolver**: `message.resolver.ts` → `getMessageReadStatus()` (line 22)
2. **Service**: `backend/receiver-service/src/message/message.service.ts`
   - `getMessageReadStatus()` method (line 45)
   - Get message and chat (line 46-47)
   - Calculate participants (line 50)
   - Get read receipts (line 54-56)
   - Calculate read status (line 58-59)

#### Database Operations
- **Repository**: MessageRead entity repository
- **Operations**: 
  - Query message by ID
  - Query chat participants
  - Query read receipts for message
- **Tables**: `messages`, `chats`, `message_reads`

#### Exit Point
- **Success**: Read status data returned
- **UI Update**: Blue/gray tick displayed based on `isFullyRead`
- **File**: `ReadReceiptIndicator.tsx` → tick color logic

#### File References
```
frontend/src/components/ReadReceiptIndicator.tsx
frontend/src/apollo/client.ts
frontend/src/graphql/queries.ts (GET_MESSAGE_READ_STATUS)
backend/receiver-service/src/message/message.resolver.ts
backend/receiver-service/src/message/message.service.ts
backend/receiver-service/src/message/dto/message-read-status.dto.ts
```

---

### Flow 12: Read Receipt Subscription Flow

**Purpose**: Real-time updates for read receipt changes

#### Entry Point
- **UI Component**: `frontend/src/components/ReadReceiptIndicator.tsx`
- **Trigger**: Component mounts
- **Entry Function**: `useSubscription(MESSAGE_READ_UPDATED)`

#### Frontend Processing
1. **Subscription Setup**: `ReadReceiptIndicator.tsx` → `useSubscription`
2. **Apollo Client**: WebSocket connection to Receiver Service

#### Backend Service
- **Service**: Receiver Service (Port 4005 or 4006)
- **Resolver**: `backend/receiver-service/src/message/message.resolver.ts`
- **Method**: `messageReadUpdated` subscription (line 79)

#### Service Processing
1. **Subscription**: `message.resolver.ts` → `messageReadUpdated()` (line 79)
2. **Filter**: Only for specific message ID (line 76)
3. **Async Iterator**: Redis PubSub async iterator

#### Redis PubSub
- **Channel**: `messageReadUpdated`
- **Listener**: Receiver service listens for read receipt updates

#### Real-time Processing
1. **Read Receipt Update**: Redis event triggers subscription
2. **WebSocket Push**: Receiver service pushes to clients
3. **Frontend Handler**: Subscription callback
4. **UI Update**: Read receipt indicator updated

#### Exit Point
- **Success**: Read receipt indicator updated in real-time
- **UI Update**: Tick color changes based on read status

#### File References
```
frontend/src/components/ReadReceiptIndicator.tsx
frontend/src/graphql/queries.ts (MESSAGE_READ_UPDATED)
backend/receiver-service/src/message/message.resolver.ts
backend/receiver-service/src/message/dto/message-read-update.dto.ts
```

---

## 🔵 Unread Count Flows

### Flow 13: Increment Unread Count Flow

**Purpose**: Increment unread count when new message received

#### Entry Point
- **Trigger**: Message created in sender service
- **Entry Function**: `message.service.ts` → `create()` → unread count increment (line 64)

#### Backend Processing
1. **Message Service**: `backend/sender-service/src/message/message.service.ts`
   - `create()` method (line 22)
   - Get chat participants (line 61)
   - Loop through other participants (line 64)
   - Call `unreadCountService.incrementUnreadCount()` (line 65)

#### Service Processing
1. **Unread Count Service**: `backend/sender-service/src/chat/unread-count.service.ts`
   - `incrementUnreadCount()` method (line 14)
   - Find or create unread count record (line 15-24)
   - Increment count (line 26)
   - Save to database (line 29)
   - Redis PubSub publish (line 32-38)

#### Database Operations
- **Repository**: UnreadCount entity repository
- **Operations**: 
  - Upsert unread count record
  - Increment `unreadCount` field
- **Table**: `unread_counts`

#### Redis PubSub
- **Channel**: `unreadCountUpdated`
- **Publisher**: Sender service
- **Payload**: Chat ID, user ID, new count

#### Real-time Propagation
1. **Redis**: Broadcasts to receiver services
2. **Frontend**: `useUnreadCounts` hook subscription
3. **UI Update**: Blue dot appears with count

#### Exit Point
- **Success**: Unread count incremented for all participants
- **UI Update**: Blue dot with count appears in chat list

#### File References
```
backend/sender-service/src/message/message.service.ts
backend/sender-service/src/chat/unread-count.service.ts
backend/sender-service/src/chat/entities/unread-count.entity.ts
backend/receiver-service/src/chat/unread-count.resolver.ts
frontend/src/hooks/useUnreadCounts.ts
frontend/src/components/ChatList.tsx
```

---

### Flow 14: Reset Unread Count Flow

**Purpose**: Reset unread count to 0 when user reads messages

#### Entry Point
- **Trigger**: Message marked as read in sender service
- **Entry Function**: `message.service.ts` → `markMessageAsRead()` → reset unread count (line 163)

#### Backend Processing
1. **Message Service**: `backend/sender-service/src/message/message.service.ts`
   - `markMessageAsRead()` method (line 134)
   - Check if unread count > 0 (line 162)
   - Call `unreadCountService.resetUnreadCount()` (line 163)

#### Service Processing
1. **Unread Count Service**: `backend/sender-service/src/chat/unread-count.service.ts`
   - `resetUnreadCount()` method (line 43)
   - Find or create unread count record (line 44-53)
   - Set count to 0 (line 55)
   - Save to database (line 58)
   - Redis PubSub publish (line 61-67)

#### Database Operations
- **Repository**: UnreadCount entity repository
- **Operations**: 
  - Upsert unread count record
  - Set `unreadCount` to 0
- **Table**: `unread_counts`

#### Redis PubSub
- **Channel**: `unreadCountUpdated`
- **Publisher**: Sender service
- **Payload**: Chat ID, user ID, count = 0

#### Real-time Propagation
1. **Redis**: Broadcasts to receiver services
2. **Frontend**: `useUnreadCounts` hook subscription
3. **UI Update**: Blue dot disappears

#### Exit Point
- **Success**: Unread count reset to 0
- **UI Update**: Blue dot removed from chat list

#### File References
```
backend/sender-service/src/message/message.service.ts
backend/sender-service/src/chat/unread-count.service.ts
backend/receiver-service/src/chat/unread-count.resolver.ts
frontend/src/hooks/useUnreadCounts.ts
frontend/src/components/ChatList.tsx
```

---

### Flow 15: Unread Count Subscription Flow

**Purpose**: Real-time updates for unread count changes

#### Entry Point
- **UI Component**: `frontend/src/hooks/useUnreadCounts.ts`
- **Trigger**: Hook initialization
- **Entry Function**: `useSubscription(UNREAD_COUNT_UPDATED)` (line 41)

#### Frontend Processing
1. **Hook Setup**: `useUnreadCounts.ts` → `useSubscription`
2. **Apollo Client**: WebSocket connection to Receiver Service

#### Backend Service
- **Service**: Receiver Service (Port 4005 or 4006)
- **Resolver**: `backend/receiver-service/src/chat/unread-count.resolver.ts`
- **Method**: `unreadCountUpdated` subscription (line 28)

#### Service Processing
1. **Subscription**: `unread-count.resolver.ts` → `unreadCountUpdated()` (line 28)
2. **Filter**: Only for specific user ID (line 25)
3. **Async Iterator**: Redis PubSub async iterator

#### Redis PubSub
- **Channel**: `unreadCountUpdated`
- **Listener**: Receiver service listens for count updates

#### Real-time Processing
1. **Count Update**: Redis event triggers subscription
2. **WebSocket Push**: Receiver service pushes to clients
3. **Frontend Handler**: `onData` callback (line 44)
4. **State Update**: `setUnreadCounts()` called (line 47)

#### Exit Point
- **Success**: Unread count state updated in hook
- **UI Update**: Blue dots and counts updated in chat list

#### File References
```
frontend/src/hooks/useUnreadCounts.ts
frontend/src/components/ChatList.tsx
frontend/src/components/UnreadIndicator.tsx
frontend/src/graphql/queries.ts (UNREAD_COUNT_UPDATED)
backend/receiver-service/src/chat/unread-count.resolver.ts
backend/receiver-service/src/chat/dto/unread-count-update.dto.ts
```

---

## 🔄 Special Scenarios

### Flow 16: Cross-Instance Messaging Flow

**Purpose**: Message sent from one instance reaches users on different instances

#### Scenario
- User A on Sender Instance 1 (Port 4002) sends message
- User B connected to Receiver Instance 1 (Port 4005)
- User C connected to Receiver Instance 2 (Port 4006)

#### Flow Steps
1. **Message Creation**: User A → Sender Service 1 (4002)
2. **Database Save**: Message saved to PostgreSQL
3. **Redis Publish**: Multiple channels published to Redis
4. **Redis Broadcast**: All receiver instances receive events
5. **Receiver Service 1**: Pushes to User B via WebSocket
6. **Receiver Service 2**: Pushes to User C via WebSocket
7. **Result**: All users receive message regardless of instance

#### Key Files
```
backend/sender-service/src/message/message.service.ts (publish)
backend/receiver-service/src/message/message.resolver.ts (subscribe)
backend/sender-service/src/common/redis-pubsub.provider.ts
backend/receiver-service/src/common/redis-pubsub.provider.ts
```

---

### Flow 17: WebSocket Reconnection Flow

**Purpose**: Handle WebSocket connection drops and reconnections

#### Entry Point
- **Trigger**: WebSocket connection lost
- **File**: `frontend/src/apollo/client.ts`

#### Reconnection Logic
1. **Connection Loss**: WebSocket client detects disconnection
2. **Retry Logic**: `shouldRetry: () => true` (line 42)
3. **Retry Attempts**: `retryAttempts: 5` (line 43)
4. **Exponential Backoff**: Built into graphql-ws client
5. **Reconnection**: New WebSocket connection established
6. **Subscription Resume**: All subscriptions automatically resume

#### Event Handlers
```typescript
wsClient.on('connected', () => console.log('WebSocket connected'));
wsClient.on('closed', () => console.log('WebSocket closed'));
wsClient.on('error', (error) => console.error('WebSocket error:', error));
```

#### Exit Point
- **Success**: All subscriptions resume, real-time updates continue
- **Failure**: Manual page refresh required

---

### Flow 18: Instance Selection/Switching Flow

**Purpose**: User manually selects which backend instances to connect to

#### Entry Point
- **UI Component**: `frontend/src/components/InstanceSelector.tsx`
- **Trigger**: User changes instance selection
- **Entry Function**: Dropdown change handler

#### Frontend Processing
1. **Selection Change**: Instance dropdown updated
2. **LocalStorage Update**: New ports stored
3. **Page Reload**: `window.location.reload()` called (line 235)
4. **Apollo Client Recreation**: `createApolloClient()` called

#### Apollo Client Recreation
1. **Close Existing**: `currentApolloClient.stop()` (line 152)
2. **New WebSocket**: `createWsLink()` with new port
3. **New HTTP Links**: `createSenderLink()` and `createReceiverLink()`
4. **Client Creation**: New Apollo client instance

#### Backend Processing
- **No Backend Changes**: Same services, different ports
- **Load Balancing**: Manual selection instead of automatic

#### Exit Point
- **Success**: User connected to selected instances
- **UI Update**: Instance selector shows current selection

#### File References
```
frontend/src/components/InstanceSelector.tsx
frontend/src/apollo/client.ts
frontend/src/utils/session.ts
```

---

### Flow 19: Error Handling Flows

**Purpose**: Handle various error scenarios gracefully

#### Database Connection Errors
1. **Detection**: TypeORM connection failures
2. **Health Check**: Service health endpoints
3. **Retry Logic**: Built into TypeORM
4. **Fallback**: Service becomes unavailable

#### Redis Connection Errors
1. **Detection**: Redis PubSub connection failures
2. **Impact**: Real-time features stop working
3. **Fallback**: Messages still saved to database
4. **Recovery**: Automatic reconnection attempts

#### WebSocket Errors
1. **Detection**: Connection loss or errors
2. **Retry Logic**: Exponential backoff
3. **Fallback**: Polling for updates
4. **Recovery**: Page refresh if needed

#### GraphQL Errors
1. **Validation Errors**: Input validation failures
2. **Authorization Errors**: Permission denied
3. **Not Found Errors**: Resource doesn't exist
4. **Network Errors**: Connection issues

#### Error Propagation
1. **Backend**: Service throws appropriate HTTP exceptions
2. **Apollo Client**: Error handling in queries/mutations
3. **Frontend**: Error boundaries and user notifications
4. **Logging**: Console errors and debugging info

---

## 📋 Flow Summary Table

| Flow ID | Flow Name | Entry Point | Primary Service | Database Tables | Redis Channels |
|---------|-----------|-------------|-----------------|-----------------|----------------|
| 1 | User Registration | Login.tsx | User Service | users | - |
| 2 | User Lookup | Login.tsx | User Service | users | - |
| 3 | Create Chat | ChatApp.tsx | Sender Service | chats | chatAdded |
| 4 | Get User Chats | ChatApp.tsx | Receiver Service | chats, messages | - |
| 5 | Add Participants | AddUsersModal.tsx | Sender Service | chats | chatUpdated |
| 6 | Send Message | ChatWindow.tsx | Sender Service | messages, unread_counts | messageAdded, chatMessageNotification, messageUpdateForChatList |
| 7 | Receive Message | ChatApp.tsx | Receiver Service | - | messageAdded |
| 8 | Update Message | - | Sender Service | messages | messageUpdated |
| 9 | Delete Message | - | Sender Service | messages | messageDeleted |
| 10 | Mark as Read | ChatWindow.tsx | Sender Service | message_reads, unread_counts | messageReadUpdated |
| 11 | Read Status Query | ReadReceiptIndicator.tsx | Receiver Service | messages, chats, message_reads | - |
| 12 | Read Receipt Subscription | ReadReceiptIndicator.tsx | Receiver Service | - | messageReadUpdated |
| 13 | Increment Unread | Message Service | Sender Service | unread_counts | unreadCountUpdated |
| 14 | Reset Unread | Message Service | Sender Service | unread_counts | unreadCountUpdated |
| 15 | Unread Subscription | useUnreadCounts.ts | Receiver Service | - | unreadCountUpdated |

---

## 🎯 Key Takeaways

### Multi-Instance Architecture Benefits
1. **Horizontal Scaling**: Multiple instances handle more load
2. **Fault Tolerance**: One instance failure doesn't affect others
3. **Load Distribution**: Users can be distributed across instances
4. **Independent Scaling**: Read and write services scale separately

### Real-time Communication
1. **Redis PubSub**: Central message broker for all instances
2. **WebSocket Subscriptions**: Direct real-time updates to clients
3. **Event-Driven**: All changes propagate via events
4. **Cross-Instance**: Messages reach all participants regardless of instance

### Data Consistency
1. **Single Database**: All instances share PostgreSQL database
2. **Eventual Consistency**: Redis introduces slight delay but ensures consistency
3. **Read After Write**: Database writes happen before Redis publishes
4. **Transaction Safety**: Database operations are ACID compliant

### Frontend Architecture
1. **Smart Routing**: Apollo Client automatically routes to correct service
2. **Instance Selection**: Manual instance selection for testing
3. **Optimistic Updates**: UI updates immediately, syncs with server
4. **Error Handling**: Comprehensive error handling at all levels

This documentation provides a complete reference for understanding every flow in the multiple-instance chat system, from user interactions through database operations to real-time updates across all service instances.
