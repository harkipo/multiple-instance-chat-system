# System Architecture Overview

## 🏗️ High-Level Architecture

The multiple instance chat system implements a **segregated microservices architecture** with clear separation between read and write operations. This design choice is fundamental to the system's scalability and performance characteristics.

### Architecture Diagram

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

## 🎯 Microservices Segregation Pattern

### Why Separate Sender and Receiver Services?

The decision to separate read and write operations into distinct services is not arbitrary—it's based on specific performance bottlenecks and scalability requirements:

#### 1. **Read vs Write Load Patterns**

**Write Operations (Sender Service)**:
- Low frequency but high impact
- Require data consistency and validation
- Need to publish events to Redis
- Must handle concurrent access to shared resources
- Critical path for user experience

**Read Operations (Receiver Service)**:
- High frequency, especially with real-time subscriptions
- Can be optimized for speed and caching
- Need to handle many concurrent WebSocket connections
- Can be scaled horizontally more easily
- Less critical for data consistency

#### 2. **Specific Bottlenecks Solved**

**WebSocket Connection Limits**:
- Each Node.js process can handle ~10,000 WebSocket connections
- By separating read operations, we can scale receiver instances independently
- Write operations don't compete for WebSocket resources

**Database Connection Pool Optimization**:
- Sender services need fewer but more stable connections for writes
- Receiver services need more connections for concurrent reads
- Different pool configurations per service type

**Memory Usage Patterns**:
- Receiver services need more memory for subscription management
- Sender services need more CPU for validation and event publishing
- Independent scaling based on actual resource needs

#### 3. **Network Latency Considerations**

**Write Operations**:
- Must reach database and Redis synchronously
- User expects immediate feedback
- Can't be cached or optimized away

**Read Operations**:
- Can use database read replicas
- Can implement aggressive caching
- Can batch multiple queries together

### Trade-offs Analysis

#### ✅ Benefits

1. **Independent Scaling**:
   - Scale receiver services for high read load
   - Scale sender services for write throughput
   - Optimize resources based on actual usage

2. **Performance Optimization**:
   - Receiver services optimized for query speed
   - Sender services optimized for data consistency
   - Different caching strategies per service

3. **Fault Isolation**:
   - Read operations continue if write service fails
   - Write operations continue if read service fails
   - Easier to debug and monitor specific issues

4. **Development Velocity**:
   - Teams can work on read/write features independently
   - Different deployment cycles
   - Easier testing of specific operations

#### ❌ Costs

1. **Increased Complexity**:
   - More services to deploy and monitor
   - Network communication between services
   - Eventual consistency considerations

2. **Network Latency**:
   - Additional network hops for cross-service operations
   - Redis PubSub introduces ~1-2ms latency
   - Potential for network partitions

3. **Data Consistency**:
   - Eventual consistency between read and write
   - Complex error handling across services
   - Race condition possibilities

4. **Operational Overhead**:
   - More containers to manage
   - Additional monitoring and logging
   - More complex deployment pipeline

## 🔄 Why Not Full CQRS with Event Sourcing?

### Current Approach vs Full CQRS

**Our Implementation** (Simplified CQRS):
```
Write Model → Database + Redis PubSub → Read Model
```

**Full CQRS with Event Sourcing**:
```
Commands → Event Store → Projections → Read Models
```

### Why We Chose the Simpler Approach

#### 1. **Complexity vs Benefit**

**Event Sourcing Benefits**:
- Complete audit trail
- Time-travel capabilities
- Event replay for debugging
- Perfect eventual consistency

**Event Sourcing Costs**:
- Complex event store implementation
- Event versioning and migration
- Snapshot management
- Learning curve for team

**Our Decision**: For a chat system, the audit trail and time-travel features don't provide enough value to justify the complexity.

#### 2. **Performance Requirements**

**Event Sourcing Overhead**:
- Every write becomes multiple writes (event + projection updates)
- Event store queries can be complex
- Snapshot rebuilding can be expensive

**Our Needs**:
- Simple message creation and retrieval
- Real-time delivery is more important than perfect audit
- Linear scaling is more important than advanced features

#### 3. **Team Expertise**

**Event Sourcing Requires**:
- Deep understanding of domain modeling
- Experience with event store patterns
- Sophisticated error handling
- Complex testing strategies

**Our Team**:
- Strong in traditional CRUD patterns
- Experienced with GraphQL and real-time systems
- Focused on rapid iteration and deployment

### When Full CQRS Would Be Better

1. **Financial Systems**: Need perfect audit trails
2. **Compliance Requirements**: Must track every state change
3. **Complex Business Logic**: Multiple bounded contexts
4. **Long-term Analytics**: Need to analyze historical patterns

## 🏢 When This Pattern Works vs Monolith

### This Pattern Works Best When:

#### 1. **Read/Write Load Imbalance**
- Read operations are 10x more frequent than writes
- Different performance requirements for each
- Can benefit from different optimization strategies

#### 2. **Horizontal Scaling Requirements**
- Need to scale beyond single instance limits
- Different scaling characteristics for read/write
- Want to optimize costs based on actual usage

#### 3. **Team Structure**
- Separate teams for read/write features
- Different deployment cycles needed
- Independent development and testing

#### 4. **Technology Optimization**
- Different databases for read/write (e.g., PostgreSQL + Elasticsearch)
- Different caching strategies needed
- Specialized tools for each operation type

### Monolith Would Be Better When:

#### 1. **Small Team/Simple Requirements**
- Single team handling all features
- Simple business logic
- No immediate scaling needs

#### 2. **Consistency Requirements**
- Strong consistency more important than performance
- Complex transactions across multiple entities
- ACID properties critical

#### 3. **Development Speed**
- Need rapid prototyping
- Frequent changes across service boundaries
- Limited DevOps resources

#### 4. **Low Complexity**
- Simple data model
- Few external integrations
- Standard CRUD operations

## 🔗 Service Communication Patterns

### 1. **Synchronous Communication**

**HTTP/GraphQL**:
- Used for user-initiated operations
- Request-response pattern
- Immediate feedback to user

**Implementation**:
```typescript
// Frontend → Sender Service (Mutation)
const [createMessage] = useMutation(CREATE_MESSAGE);
await createMessage({ variables: { content: "Hello" } });

// Frontend → Receiver Service (Query)
const { data } = useQuery(GET_MESSAGES, { variables: { chatId } });
```

### 2. **Asynchronous Communication**

**Redis PubSub**:
- Used for cross-instance communication
- Event-driven pattern
- Real-time updates to clients

**Implementation**:
```typescript
// Sender Service publishes
await pubSub.publish('messageAdded', { messageAdded: message });

// Receiver Service subscribes
return pubSub.asyncIterator('messageAdded');
```

### 3. **Hybrid Communication**

**Write-then-Publish Pattern**:
1. Write to database (synchronous)
2. Publish to Redis (asynchronous)
3. Receiver services push to clients (asynchronous)

## 📊 Data Flow Patterns

### 1. **Message Creation Flow**

```
User Input → Frontend → Sender Service → Database
                    ↓
            Redis PubSub → Receiver Services → WebSocket → All Clients
```

**Detailed Steps**:
1. User types message and hits send
2. Frontend sends GraphQL mutation to Sender Service
3. Sender Service validates user permissions
4. Message saved to PostgreSQL
5. Unread counts incremented
6. Event published to Redis PubSub
7. All Receiver Service instances receive event
8. Each Receiver Service pushes to connected WebSocket clients
9. Frontend receives real-time update

### 2. **Read Operations Flow**

```
Client Request → Frontend → Receiver Service → Database → Response
```

**Optimization Opportunities**:
- Database query optimization
- Response caching
- Connection pooling
- Read replica usage

### 3. **Real-time Subscription Flow**

```
Client → WebSocket → Receiver Service → Redis Subscription → Event → Client
```

**Connection Management**:
- Automatic reconnection on failure
- Connection state tracking
- Subscription filtering by chat ID
- Graceful degradation on errors

## 🎛️ Service Responsibilities

### User Service
- **Purpose**: User account management and authentication
- **Operations**: CRUD operations on users
- **Data**: User profiles, credentials, preferences
- **Scaling**: Can scale based on user registration/login load

### Sender Service
- **Purpose**: Handle all write operations
- **Operations**: Create, update, delete messages and chats
- **Responsibilities**:
  - Data validation and authorization
  - Database writes with transactions
  - Event publishing to Redis
  - Unread count management
- **Scaling**: Scale based on message creation rate

### Receiver Service
- **Purpose**: Handle all read operations and real-time subscriptions
- **Operations**: Query messages, chats, unread counts
- **Responsibilities**:
  - Database reads with optimization
  - WebSocket connection management
  - Redis subscription handling
  - Real-time event broadcasting
- **Scaling**: Scale based on concurrent users and subscriptions

## 🔍 Architecture Decision Records

### ADR-001: Service Segregation
**Status**: Accepted
**Context**: Need to handle high read load with real-time requirements
**Decision**: Separate read and write operations into distinct services
**Consequences**: Increased complexity but better scalability

### ADR-002: Redis PubSub for Communication
**Status**: Accepted
**Context**: Need reliable cross-instance communication
**Decision**: Use Redis PubSub instead of direct HTTP calls
**Consequences**: Single point of failure but simpler than message queues

### ADR-003: GraphQL for All APIs
**Status**: Accepted
**Context**: Need type-safe APIs with real-time subscriptions
**Decision**: Use GraphQL for all service communication
**Consequences**: Learning curve but better developer experience

## 📈 Scalability Characteristics

### Horizontal Scaling
- **User Service**: Can run multiple instances behind load balancer
- **Sender Service**: Can scale based on write throughput needs
- **Receiver Service**: Can scale based on concurrent connections

### Vertical Scaling
- **Receiver Services**: Benefit from more RAM for WebSocket connections
- **Sender Services**: Benefit from more CPU for validation and publishing
- **Database**: Can be optimized with read replicas and connection pooling

### Resource Optimization
- **Memory**: Receiver services need more memory for subscriptions
- **CPU**: Sender services need more CPU for data processing
- **Network**: Redis PubSub reduces direct service-to-service calls
- **Storage**: Database optimized for both read and write patterns

This architecture provides a solid foundation for a scalable real-time chat system while maintaining simplicity and developer experience. The segregation allows for independent optimization and scaling of read and write operations, which is crucial for chat applications with their characteristic read-heavy, real-time nature.
