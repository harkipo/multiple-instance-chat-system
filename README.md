# Real-time Chat System

A scalable real-time chat system built with TypeScript, NestJS, GraphQL, PostgreSQL, Redis, and React. Features microservices architecture with multiple instances for horizontal scaling, real-time messaging, read receipts, and unread message indicators.

## 🏗️ Architecture

**Backend Services:**
- **User Service** (Ports 4001/4003): User management and authentication
- **Sender Service** (Ports 4002/4004): Handles mutations (create chat, send messages, mark as read)
- **Receiver Service** (Ports 4005/4006): Handles queries and subscriptions (fetch data, real-time updates)
- **PostgreSQL**: Shared database for data persistence
- **Redis**: Message broker for real-time pub/sub across service instances

**Frontend:**
- **React Application** (Port 3000): Modern UI with real-time updates
- **Apollo Client**: Smart routing to appropriate backend services
- **WebSocket Subscriptions**: Real-time message delivery and status updates

## 🎯 Key Features

- ✅ **Real-time Messaging**: Instant message delivery via WebSocket
- ✅ **1:1 and Group Chats**: Support for direct and group conversations
- ✅ **Read Receipts**: Blue/gray ticks showing message read status
- ✅ **Unread Indicators**: Blue dots with unread message counts
- ✅ **Multi-Instance Support**: Run multiple backend instances for horizontal scaling
- ✅ **Message Editing/Deletion**: Edit and delete sent messages
- ✅ **Responsive UI**: Modern, mobile-friendly interface

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose (for Docker setup)
- Node.js 18+ (for local development)
- PostgreSQL and Redis (for local development)

### Option 1: Docker Setup (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd multiple-instance-chat-system
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

### Option 2: Local Development Setup

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

4. **Access the application:**
   - Frontend: http://localhost:3000
   - User Service: http://localhost:4001/graphql
   - Sender Service: http://localhost:4002/graphql
   - Receiver Service: http://localhost:4005/graphql

## 📚 Documentation

For detailed information, see the `docs/` directory:
- **[System Overview](./docs/architecture/01-SYSTEM-OVERVIEW.md)** - High-level system architecture
- **[Technology Choices](./docs/architecture/02-TECHNOLOGY-CHOICES.md)** - Technology stack decisions
- **[Detailed Flows](./docs/DETAILED_FLOWS.md)** - Complete user flows and interactions
- **[Multi-Instance Implementation](./MULTI_INSTANCE_IMPLEMENTATION.md)** - Multi-instance setup guide

## 📄 License

This project is licensed under the MIT License.

---

**Built with** ❤️ **using modern technologies and best practices for scalable real-time applications.**
