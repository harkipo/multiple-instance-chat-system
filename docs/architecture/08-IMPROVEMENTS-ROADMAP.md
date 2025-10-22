# Improvements Roadmap

## 🎯 Overview

This document provides a comprehensive roadmap for improving the multiple instance chat system, detailing implementation approaches, benefits, effort required, and priority for each improvement. The roadmap is organized by phases to ensure systematic development and deployment.

## 🔐 Phase 1: Authentication & Authorization

### 1.1 JWT Authentication Implementation

**Current State**: No authentication system
**Target State**: JWT-based authentication with refresh tokens

#### Implementation Approach

**Backend Implementation**:
```typescript
// JWT Service
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userService.findByUsername(username);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userService.findOne(payload.sub);
      if (user) {
        return this.login(user);
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
```

**User Entity Updates**:
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // Hashed password

  @Column({ nullable: true })
  displayName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Password hashing
  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }
}
```

**JWT Guard Implementation**:
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
```

**Resolver Protection**:
```typescript
@Resolver(() => Message)
export class MessageResolver {
  @UseGuards(JwtAuthGuard)
  @Mutation(() => Message)
  async createMessage(
    @Args('createMessageInput') input: CreateMessageInput,
    @CurrentUser() user: User
  ): Promise<Message> {
    // User is authenticated and available
    return this.messageService.create(input, user.id);
  }
}
```

#### Benefits
- **Security**: Secure user authentication
- **Session Management**: Proper session handling
- **Multi-Device Support**: JWT works across devices
- **Scalability**: Stateless authentication
- **Standards Compliance**: Industry-standard JWT implementation

#### Effort Required
- **Backend**: 2-3 weeks
- **Frontend**: 1-2 weeks
- **Testing**: 1 week
- **Total**: 4-6 weeks

#### Priority: HIGH

### 1.2 RBAC Authorization System

**Current State**: Basic participation checks only
**Target State**: Role-based access control with permissions

#### Implementation Approach

**Role and Permission Entities**:
```typescript
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @ManyToMany(() => Permission)
  @JoinTable()
  permissions: Permission[];
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  resource: string;

  @Column()
  action: string;
}

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  roleId: string;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Role)
  role: Role;
}
```

**Authorization Service**:
```typescript
@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.permissions'],
    });

    return userRoles.some(userRole =>
      userRole.role.permissions.some(permission =>
        permission.resource === resource && permission.action === action
      )
    );
  }

  async canAccessChat(userId: string, chatId: string): Promise<boolean> {
    // Check if user is participant or has admin role
    const isParticipant = await this.chatService.isParticipant(chatId, userId);
    const isAdmin = await this.hasPermission(userId, 'chat', 'admin');
    
    return isParticipant || isAdmin;
  }
}
```

**Permission Decorator**:
```typescript
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata('permission', { resource, action });

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private authService: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const permission = Reflector.getMetadata('permission', context.getHandler());

    if (!permission) {
      return true;
    }

    return this.authService.hasPermission(
      user.id,
      permission.resource,
      permission.action
    );
  }
}
```

**Usage in Resolvers**:
```typescript
@Resolver(() => Chat)
export class ChatResolver {
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('chat', 'create')
  @Mutation(() => Chat)
  async createChat(
    @Args('createChatInput') input: CreateChatInput,
    @CurrentUser() user: User
  ): Promise<Chat> {
    return this.chatService.create(input, user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('chat', 'admin')
  @Mutation(() => Chat)
  async deleteChat(
    @Args('id') id: string,
    @CurrentUser() user: User
  ): Promise<Chat> {
    return this.chatService.remove(id, user.id);
  }
}
```

#### Benefits
- **Granular Control**: Fine-grained permission system
- **Flexibility**: Easy to add new roles and permissions
- **Audit Trail**: Track user actions and permissions
- **Compliance**: Meet enterprise security requirements
- **Scalability**: Support for complex permission hierarchies

#### Effort Required
- **Backend**: 3-4 weeks
- **Database**: 1 week
- **Testing**: 2 weeks
- **Total**: 6-7 weeks

#### Priority: HIGH

## 🚦 Phase 2: Rate Limiting & Security

### 2.1 Redis-Based Rate Limiting

**Current State**: No rate limiting
**Target State**: Redis-based rate limiting with multiple strategies

#### Implementation Approach

**Rate Limiting Service**:
```typescript
@Injectable()
export class RateLimitService {
  constructor(
    @InjectRedis() private redis: Redis,
  ) {}

  async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - window * 1000;
    
    // Remove expired entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const currentCount = await this.redis.zcard(key);
    
    if (currentCount >= limit) {
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestRequest[1] + window * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.ceil((resetTime - now) / 1000)
      };
    }
    
    // Add current request
    await this.redis.zadd(key, now, now);
    await this.redis.expire(key, window);
    
    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetTime: window
    };
  }

  async checkUserRateLimit(userId: string, limit: number, window: number) {
    return this.checkRateLimit(`rate_limit:user:${userId}`, limit, window);
  }

  async checkIPRateLimit(ip: string, limit: number, window: number) {
    return this.checkRateLimit(`rate_limit:ip:${ip}`, limit, window);
  }
}
```

**Rate Limiting Guard**:
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private rateLimitService: RateLimitService,
    @InjectRedis() private redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = request.ip;
    
    // Get rate limit configuration
    const config = this.getRateLimitConfig(context);
    
    // Check user rate limit
    if (user) {
      const userLimit = await this.rateLimitService.checkUserRateLimit(
        user.id,
        config.userLimit,
        config.window
      );
      
      if (!userLimit.allowed) {
        throw new TooManyRequestsException({
          message: 'User rate limit exceeded',
          remaining: userLimit.remaining,
          resetTime: userLimit.resetTime
        });
      }
    }
    
    // Check IP rate limit
    const ipLimit = await this.rateLimitService.checkIPRateLimit(
      ip,
      config.ipLimit,
      config.window
    );
    
    if (!ipLimit.allowed) {
      throw new TooManyRequestsException({
        message: 'IP rate limit exceeded',
        remaining: ipLimit.remaining,
        resetTime: ipLimit.resetTime
      });
    }
    
    return true;
  }

  private getRateLimitConfig(context: ExecutionContext) {
    const handler = context.getHandler();
    const rateLimit = Reflector.getMetadata('rate_limit', handler);
    
    return rateLimit || {
      userLimit: 100, // 100 requests per window
      ipLimit: 1000,  // 1000 requests per window
      window: 3600    // 1 hour window
    };
  }
}
```

**Rate Limit Decorator**:
```typescript
export const RateLimit = (config: {
  userLimit?: number;
  ipLimit?: number;
  window?: number;
}) => SetMetadata('rate_limit', config);

// Usage
@UseGuards(RateLimitGuard)
@RateLimit({ userLimit: 50, ipLimit: 500, window: 3600 })
@Mutation(() => Message)
async createMessage(@Args('input') input: CreateMessageInput): Promise<Message> {
  return this.messageService.create(input);
}
```

**Message Rate Limiting**:
```typescript
@Injectable()
export class MessageRateLimitService {
  constructor(private rateLimitService: RateLimitService) {}

  async checkMessageRateLimit(userId: string, chatId: string): Promise<boolean> {
    // Global message rate limit
    const globalLimit = await this.rateLimitService.checkUserRateLimit(
      `message:${userId}`,
      100, // 100 messages per hour
      3600
    );
    
    if (!globalLimit.allowed) {
      return false;
    }
    
    // Per-chat rate limit
    const chatLimit = await this.rateLimitService.checkUserRateLimit(
      `message:${userId}:${chatId}`,
      50, // 50 messages per hour per chat
      3600
    );
    
    return chatLimit.allowed;
  }
}
```

#### Benefits
- **DoS Protection**: Prevent denial of service attacks
- **Resource Protection**: Prevent resource exhaustion
- **Fair Usage**: Ensure fair usage across users
- **Configurable**: Flexible rate limiting configuration
- **Performance**: Redis-based for high performance

#### Effort Required
- **Backend**: 2-3 weeks
- **Redis Setup**: 1 week
- **Testing**: 1 week
- **Total**: 4-5 weeks

#### Priority: MEDIUM

### 2.2 Input Validation & Sanitization

**Current State**: Basic validation
**Target State**: Comprehensive input validation and sanitization

#### Implementation Approach

**Enhanced Validation**:
```typescript
@InputType()
export class CreateMessageInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => sanitizeHtml(value)) // Sanitize HTML
  content: string;

  @Field()
  @IsUUID()
  senderId: string;

  @Field()
  @IsUUID()
  chatId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10) // Limit attachments
  attachments?: string[];
}

@InputType()
export class CreateUserInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/) // Only alphanumeric, underscore, hyphen
  username: string;

  @Field()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  password: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => sanitizeHtml(value))
  displayName?: string;
}
```

**Custom Validation**:
```typescript
@ValidatorConstraint({ name: 'isValidMessageContent', async: false })
export class IsValidMessageContent implements ValidatorConstraintInterface {
  validate(content: string): boolean {
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{4,}/, // Repeated characters
      /https?:\/\/[^\s]+/gi, // URLs (if not allowed)
      /[A-Z]{5,}/, // Excessive caps
    ];
    
    return !spamPatterns.some(pattern => pattern.test(content));
  }

  defaultMessage(): string {
    return 'Message content contains invalid patterns';
  }
}

@InputType()
export class CreateMessageInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @Validate(IsValidMessageContent)
  content: string;
}
```

**Sanitization Service**:
```typescript
@Injectable()
export class SanitizationService {
  private readonly allowedTags = ['b', 'i', 'em', 'strong', 'code'];
  private readonly allowedAttributes = {};

  sanitizeHtml(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: this.allowedTags,
      allowedAttributes: this.allowedAttributes,
      disallowedTagsMode: 'discard',
    });
  }

  sanitizeText(text: string): string {
    return text
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }
}
```

#### Benefits
- **Security**: Prevent XSS and injection attacks
- **Data Quality**: Ensure clean, valid data
- **User Experience**: Better error messages
- **Compliance**: Meet security standards
- **Maintainability**: Centralized validation logic

#### Effort Required
- **Backend**: 2-3 weeks
- **Testing**: 1 week
- **Total**: 3-4 weeks

#### Priority: MEDIUM

## 📄 Phase 3: Pagination & Performance

### 3.1 Cursor-Based Pagination

**Current State**: No pagination
**Target State**: Cursor-based pagination for all list endpoints

#### Implementation Approach

**Pagination Service**:
```typescript
@Injectable()
export class PaginationService {
  constructor() {}

  createCursor(data: any, sortField: string): string {
    const value = data[sortField];
    return Buffer.from(JSON.stringify({ [sortField]: value })).toString('base64');
  }

  parseCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch (error) {
      throw new BadRequestException('Invalid cursor');
    }
  }

  async paginate<T>(
    queryBuilder: SelectQueryBuilder<T>,
    cursor: string,
    limit: number,
    sortField: string
  ): Promise<{ items: T[]; nextCursor: string | null; hasNext: boolean }> {
    // Apply cursor-based filtering
    if (cursor) {
      const cursorData = this.parseCursor(cursor);
      queryBuilder.andWhere(`${sortField} > :cursorValue`, {
        cursorValue: cursorData[sortField]
      });
    }

    // Apply limit + 1 to check if there are more items
    const items = await queryBuilder
      .orderBy(sortField, 'ASC')
      .limit(limit + 1)
      .getMany();

    const hasNext = items.length > limit;
    const resultItems = hasNext ? items.slice(0, limit) : items;
    const nextCursor = hasNext ? this.createCursor(resultItems[resultItems.length - 1], sortField) : null;

    return {
      items: resultItems,
      nextCursor,
      hasNext
    };
  }
}
```

**Message Pagination**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private paginationService: PaginationService,
  ) {}

  async findMessages(
    chatId: string,
    cursor?: string,
    limit: number = 50
  ): Promise<{ items: Message[]; nextCursor: string | null; hasNext: boolean }> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.chatId = :chatId', { chatId })
      .leftJoinAndSelect('message.reads', 'reads');

    return this.paginationService.paginate(
      queryBuilder,
      cursor,
      limit,
      'message.createdAt'
    );
  }
}
```

**GraphQL Pagination Types**:
```typescript
@ObjectType()
export class MessageEdge {
  @Field(() => Message)
  node: Message;

  @Field()
  cursor: string;
}

@ObjectType()
export class MessageConnection {
  @Field(() => [MessageEdge])
  edges: MessageEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

@ObjectType()
export class PageInfo {
  @Field({ nullable: true })
  endCursor: string;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

@Resolver(() => Message)
export class MessageResolver {
  @Query(() => MessageConnection)
  async messages(
    @Args('chatId') chatId: string,
    @Args('first', { type: () => Int, defaultValue: 50 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<MessageConnection> {
    const result = await this.messageService.findMessages(chatId, after, first);
    
    const edges = result.items.map(message => ({
      node: message,
      cursor: this.paginationService.createCursor(message, 'createdAt')
    }));

    return {
      edges,
      pageInfo: {
        endCursor: result.nextCursor,
        hasNextPage: result.hasNext,
        hasPreviousPage: false, // Cursor-based pagination is forward-only
      }
    };
  }
}
```

**Frontend Pagination Hook**:
```typescript
export const useMessages = (chatId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage) return;

    setLoading(true);
    try {
      const { data } = await client.query({
        query: GET_MESSAGES,
        variables: { chatId, first: 50, after: cursor },
      });

      const newMessages = data.messages.edges.map(edge => edge.node);
      setMessages(prev => [...prev, ...newMessages]);
      setCursor(data.messages.pageInfo.endCursor);
      setHasNextPage(data.messages.pageInfo.hasNextPage);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId, cursor, loading, hasNextPage]);

  return { messages, loadMore, loading, hasNextPage };
};
```

#### Benefits
- **Performance**: Efficient pagination for large datasets
- **Scalability**: Works with millions of records
- **Consistency**: No duplicate or missing items
- **Real-time**: Compatible with real-time updates
- **User Experience**: Smooth infinite scroll

#### Effort Required
- **Backend**: 2-3 weeks
- **Frontend**: 2-3 weeks
- **Testing**: 1 week
- **Total**: 5-7 weeks

#### Priority: MEDIUM

### 3.2 Redis Caching Layer

**Current State**: No caching
**Target State**: Redis-based caching for frequently accessed data

#### Implementation Approach

**Cache Service**:
```typescript
@Injectable()
export class CacheService {
  constructor(
    @InjectRedis() private redis: Redis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

**Cached Message Service**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private cacheService: CacheService,
  ) {}

  async findMessages(chatId: string, limit: number = 50): Promise<Message[]> {
    const cacheKey = `messages:${chatId}:${limit}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.messageRepository.find({
          where: { chatId },
          order: { createdAt: 'DESC' },
          take: limit,
          relations: ['reads'],
        });
      },
      300 // 5 minute cache
    );
  }

  async create(input: CreateMessageInput): Promise<Message> {
    const message = await this.messageRepository.save(input);
    
    // Invalidate related caches
    await this.cacheService.invalidatePattern(`messages:${input.chatId}:*`);
    await this.cacheService.invalidatePattern(`chats:${input.chatId}`);
    
    return message;
  }
}
```

**Cached User Service**:
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cacheService: CacheService,
  ) {}

  async findOne(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
      },
      3600 // 1 hour cache
    );
  }

  async findByUsername(username: string): Promise<User> {
    const cacheKey = `user:username:${username}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.userRepository.findOne({ where: { username } });
        if (!user) {
          throw new NotFoundException(`User with username ${username} not found`);
        }
        return user;
      },
      3600 // 1 hour cache
    );
  }
}
```

**Cache Invalidation Strategy**:
```typescript
@Injectable()
export class CacheInvalidationService {
  constructor(private cacheService: CacheService) {}

  async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(`user:${userId}`),
      this.cacheService.invalidatePattern(`user:*`),
      this.cacheService.invalidatePattern(`chats:*`), // User's chats
    ]);
  }

  async invalidateChatCaches(chatId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`messages:${chatId}:*`),
      this.cacheService.del(`chat:${chatId}`),
      this.cacheService.invalidatePattern(`unread:*`),
    ]);
  }

  async invalidateMessageCaches(chatId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`messages:${chatId}:*`),
      this.cacheService.invalidatePattern(`chat:${chatId}`),
    ]);
  }
}
```

#### Benefits
- **Performance**: Faster response times
- **Scalability**: Reduced database load
- **Cost Efficiency**: Lower database costs
- **User Experience**: Faster UI updates
- **Reliability**: Fallback to database on cache miss

#### Effort Required
- **Backend**: 2-3 weeks
- **Redis Setup**: 1 week
- **Testing**: 1 week
- **Total**: 4-5 weeks

#### Priority: MEDIUM

## 🔄 Phase 4: High Availability

### 4.1 Redis High Availability

**Current State**: Single Redis instance
**Target State**: Redis Sentinel with automatic failover

#### Implementation Approach

**Redis Sentinel Configuration**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-master-data:/data
    networks:
      - redis-network

  redis-slave-1:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    volumes:
      - redis-slave-1-data:/data
    depends_on:
      - redis-master
    networks:
      - redis-network

  redis-slave-2:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    volumes:
      - redis-slave-2-data:/data
    depends_on:
      - redis-master
    networks:
      - redis-network

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    volumes:
      - ./redis-sentinel-1.conf:/usr/local/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-slave-1
      - redis-slave-2
    networks:
      - redis-network

  redis-sentinel-2:
    image: redis:7-alpine
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    volumes:
      - ./redis-sentinel-2.conf:/usr/local/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-slave-1
      - redis-slave-2
    networks:
      - redis-network

  redis-sentinel-3:
    image: redis:7-alpine
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    volumes:
      - ./redis-sentinel-3.conf:/usr/local/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-slave-1
      - redis-slave-2
    networks:
      - redis-network
```

**Sentinel Configuration**:
```conf
# redis-sentinel-1.conf
port 26379
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
```

**Redis Client with Sentinel**:
```typescript
@Injectable()
export class RedisSentinelService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      sentinels: [
        { host: 'redis-sentinel-1', port: 26379 },
        { host: 'redis-sentinel-2', port: 26379 },
        { host: 'redis-sentinel-3', port: 26379 },
      ],
      name: 'mymaster',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
  }

  getClient(): Redis {
    return this.redis;
  }
}
```

**Updated PubSub Provider**:
```typescript
@Injectable()
export class RedisPubSubProvider {
  private pubSub: RedisPubSub;

  constructor(private redisSentinelService: RedisSentinelService) {
    const redis = this.redisSentinelService.getClient();
    
    this.pubSub = new RedisPubSub({
      publisher: redis,
      subscriber: redis,
    });
  }

  getPubSub(): RedisPubSub {
    return this.pubSub;
  }
}
```

#### Benefits
- **High Availability**: Automatic failover
- **Data Persistence**: No data loss during failures
- **Scalability**: Read replicas for better performance
- **Monitoring**: Sentinel provides monitoring capabilities
- **Reliability**: Multiple sentinel instances for reliability

#### Effort Required
- **Infrastructure**: 2-3 weeks
- **Configuration**: 1 week
- **Testing**: 1 week
- **Total**: 4-5 weeks

#### Priority: HIGH

### 4.2 Database Read Replicas

**Current State**: Single database instance
**Target State**: Primary-replica setup with read/write splitting

#### Implementation Approach

**Database Configuration**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres-primary:
    image: postgres:15
    environment:
      POSTGRES_DB: chat_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
    volumes:
      - postgres-primary-data:/var/lib/postgresql/data
      - ./postgres-primary.conf:/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - database-network

  postgres-replica-1:
    image: postgres:15
    environment:
      POSTGRES_DB: chat_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      PGUSER: postgres
    volumes:
      - postgres-replica-1-data:/var/lib/postgresql/data
      - ./postgres-replica-1.conf:/etc/postgresql/postgresql.conf
    depends_on:
      - postgres-primary
    networks:
      - database-network

  postgres-replica-2:
    image: postgres:15
    environment:
      POSTGRES_DB: chat_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      PGUSER: postgres
    volumes:
      - postgres-replica-2-data:/var/lib/postgresql/data
      - ./postgres-replica-2.conf:/etc/postgresql/postgresql.conf
    depends_on:
      - postgres-primary
    networks:
      - database-network
```

**Database Service with Read/Write Splitting**:
```typescript
@Injectable()
export class DatabaseService {
  private writeConnection: DataSource;
  private readConnections: DataSource[];

  constructor() {
    this.initializeConnections();
  }

  private async initializeConnections() {
    // Write connection to primary
    this.writeConnection = new DataSource({
      type: 'postgres',
      host: 'postgres-primary',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'chat_system',
      synchronize: false,
    });

    // Read connections to replicas
    this.readConnections = [
      new DataSource({
        type: 'postgres',
        host: 'postgres-replica-1',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'chat_system',
        synchronize: false,
      }),
      new DataSource({
        type: 'postgres',
        host: 'postgres-replica-2',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'chat_system',
        synchronize: false,
      }),
    ];

    await Promise.all([
      this.writeConnection.initialize(),
      ...this.readConnections.map(conn => conn.initialize())
    ]);
  }

  getWriteConnection(): DataSource {
    return this.writeConnection;
  }

  getReadConnection(): DataSource {
    // Round-robin load balancing
    const index = Math.floor(Math.random() * this.readConnections.length);
    return this.readConnections[index];
  }
}
```

**Read/Write Service Pattern**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    private databaseService: DatabaseService,
  ) {}

  async create(input: CreateMessageInput): Promise<Message> {
    // Use write connection for mutations
    const writeRepo = this.databaseService.getWriteConnection().getRepository(Message);
    const message = writeRepo.create(input);
    return writeRepo.save(message);
  }

  async findAll(chatId: string): Promise<Message[]> {
    // Use read connection for queries
    const readRepo = this.databaseService.getReadConnection().getRepository(Message);
    return readRepo.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Message> {
    // Use read connection for queries
    const readRepo = this.databaseService.getReadConnection().getRepository(Message);
    const message = await readRepo.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return message;
  }
}
```

#### Benefits
- **Performance**: Read load distributed across replicas
- **Scalability**: Can add more read replicas
- **High Availability**: Replicas can be promoted to primary
- **Load Distribution**: Write load on primary, read load on replicas
- **Backup**: Replicas serve as backups

#### Effort Required
- **Infrastructure**: 2-3 weeks
- **Configuration**: 1 week
- **Testing**: 1 week
- **Total**: 4-5 weeks

#### Priority: MEDIUM

## 🔄 Phase 5: Reliability & Monitoring

### 5.1 Transaction Management

**Current State**: No transaction management
**Target State**: Comprehensive transaction management with rollback

#### Implementation Approach

**Transaction Service**:
```typescript
@Injectable()
export class TransactionService {
  constructor(
    private databaseService: DatabaseService,
  ) {}

  async executeInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const queryRunner = this.databaseService.getWriteConnection().createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

**Transactional Message Creation**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    private transactionService: TransactionService,
    private pubSub: PubSub,
  ) {}

  async create(input: CreateMessageInput): Promise<Message> {
    return this.transactionService.executeInTransaction(async (manager) => {
      // 1. Create message
      const message = manager.create(Message, input);
      const savedMessage = await manager.save(message);

      // 2. Update unread counts
      const chat = await manager.findOne(Chat, { where: { id: input.chatId } });
      const otherParticipants = chat.participantIds.filter(id => id !== input.senderId);
      
      for (const participantId of otherParticipants) {
        let unreadCount = await manager.findOne(UnreadCount, {
          where: { chatId: input.chatId, userId: participantId }
        });

        if (!unreadCount) {
          unreadCount = manager.create(UnreadCount, {
            chatId: input.chatId,
            userId: participantId,
            unreadCount: 1
          });
        } else {
          unreadCount.unreadCount += 1;
        }

        await manager.save(unreadCount);
      }

      // 3. Publish events (outside transaction)
      setImmediate(() => {
        this.pubSub.publish('messageAdded', { messageAdded: savedMessage });
      });

      return savedMessage;
    });
  }
}
```

**Distributed Transaction Pattern**:
```typescript
@Injectable()
export class DistributedTransactionService {
  constructor(
    private transactionService: TransactionService,
    private pubSub: PubSub,
  ) {}

  async executeDistributedTransaction<T>(
    operations: Array<{
      name: string;
      execute: () => Promise<any>;
      compensate: () => Promise<void>;
    }>
  ): Promise<T> {
    const completed: Array<{ name: string; compensate: () => Promise<void> }> = [];

    try {
      for (const operation of operations) {
        await operation.execute();
        completed.push({ name: operation.name, compensate: operation.compensate });
      }
    } catch (error) {
      // Compensate for completed operations
      for (const completedOp of completed.reverse()) {
        try {
          await completedOp.compensate();
        } catch (compensateError) {
          console.error(`Failed to compensate ${completedOp.name}:`, compensateError);
        }
      }
      throw error;
    }

    return operations[operations.length - 1].execute();
  }
}
```

#### Benefits
- **Data Consistency**: All operations succeed or fail together
- **Error Recovery**: Automatic rollback on failures
- **Reliability**: System remains consistent during failures
- **Audit Trail**: Clear transaction boundaries
- **Performance**: Reduced database round trips

#### Effort Required
- **Backend**: 2-3 weeks
- **Testing**: 1 week
- **Total**: 3-4 weeks

#### Priority: MEDIUM

### 5.2 Comprehensive Logging

**Current State**: Basic console logging
**Target State**: Structured logging with ELK stack

#### Implementation Approach

**Structured Logging Service**:
```typescript
@Injectable()
export class LoggingService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ChatSystem');
  }

  log(message: string, context?: any) {
    this.logger.log({
      message,
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    });
  }

  error(message: string, error?: Error, context?: any) {
    this.logger.error({
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      context,
      timestamp: new Date().toISOString(),
      level: 'error',
    });
  }

  warn(message: string, context?: any) {
    this.logger.warn({
      message,
      context,
      timestamp: new Date().toISOString(),
      level: 'warn',
    });
  }

  debug(message: string, context?: any) {
    this.logger.debug({
      message,
      context,
      timestamp: new Date().toISOString(),
      level: 'debug',
    });
  }
}
```

**ELK Stack Configuration**:
```yaml
# docker-compose.yml
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:8.8.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.8.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

  filebeat:
    image: elastic/filebeat:8.8.0
    volumes:
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - logstash
```

**Logstash Configuration**:
```conf
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "chat-system" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "chat-system-%{+YYYY.MM.dd}"
  }
}
```

**Application Logging**:
```typescript
@Injectable()
export class MessageService {
  constructor(
    private loggingService: LoggingService,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async create(input: CreateMessageInput): Promise<Message> {
    const startTime = Date.now();
    
    try {
      this.loggingService.log('Creating message', {
        chatId: input.chatId,
        senderId: input.senderId,
        contentLength: input.content.length,
      });

      const message = await this.messageRepository.save(input);
      
      this.loggingService.log('Message created successfully', {
        messageId: message.id,
        chatId: message.chatId,
        duration: Date.now() - startTime,
      });

      return message;
    } catch (error) {
      this.loggingService.error('Failed to create message', error, {
        chatId: input.chatId,
        senderId: input.senderId,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

#### Benefits
- **Debugging**: Easy to debug issues with structured logs
- **Monitoring**: Track system health and performance
- **Audit Trail**: Complete audit trail of system activities
- **Analytics**: Analyze system usage and patterns
- **Compliance**: Meet logging requirements

#### Effort Required
- **Infrastructure**: 2-3 weeks
- **Configuration**: 1 week
- **Testing**: 1 week
- **Total**: 4-5 weeks

#### Priority: MEDIUM

## 📊 Implementation Timeline

### Phase 1: Critical Security (Weeks 1-12)
- **Weeks 1-6**: JWT Authentication Implementation
- **Weeks 7-12**: RBAC Authorization System

### Phase 2: Performance & Scalability (Weeks 13-24)
- **Weeks 13-16**: Rate Limiting & Input Validation
- **Weeks 17-22**: Cursor-based Pagination
- **Weeks 23-24**: Redis Caching Layer

### Phase 3: High Availability (Weeks 25-34)
- **Weeks 25-29**: Redis High Availability
- **Weeks 30-34**: Database Read Replicas

### Phase 4: Reliability (Weeks 35-42)
- **Weeks 35-38**: Transaction Management
- **Weeks 39-42**: Comprehensive Logging

### Phase 5: Advanced Features (Weeks 43-52)
- **Weeks 43-46**: Advanced Monitoring
- **Weeks 47-52**: Performance Optimization

## 🎯 Success Metrics

### Performance Metrics
- **Response Time**: < 100ms for 95% of requests
- **Throughput**: > 1000 messages/second
- **Availability**: 99.9% uptime
- **Error Rate**: < 0.1% error rate

### Security Metrics
- **Authentication**: 100% of requests authenticated
- **Authorization**: 100% of requests authorized
- **Rate Limiting**: 100% of requests rate limited
- **Input Validation**: 100% of inputs validated

### Scalability Metrics
- **Concurrent Users**: Support 10,000+ concurrent users
- **Message Volume**: Handle 1M+ messages/day
- **Database Load**: < 80% database CPU usage
- **Memory Usage**: < 80% memory usage

This comprehensive roadmap provides a clear path for transforming the current system into a production-ready, scalable, and secure chat application.
