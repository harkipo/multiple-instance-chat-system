import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const createUserInput: CreateUserInput = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const mockUser = {
        id: '1',
        ...createUserInput,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null); // No existing user
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserInput);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { username: createUserInput.username },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createUserInput);
      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictException if username already exists', async () => {
      const createUserInput: CreateUserInput = {
        username: 'existinguser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const existingUser = { id: '1', username: 'existinguser' };

      mockRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.create(createUserInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserInput: CreateUserInput = {
        username: 'newuser',
        email: 'existing@example.com',
        displayName: 'Test User',
      };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // No existing username
        .mockResolvedValueOnce({ id: '1', email: 'existing@example.com' }); // Existing email

      await expect(service.create(createUserInput)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all active users', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', isActive: true },
        { id: '2', username: 'user2', isActive: true },
      ];

      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const mockUser = { id: '1', username: 'testuser', isActive: true };

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1', isActive: true },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      const mockUser = { id: '1', username: 'testuser', isActive: true };
      const updatedUser = { ...mockUser, isActive: false };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.remove('1');

      expect(result).toEqual(updatedUser);
      expect(mockUser.isActive).toBe(false);
      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    });
  });
});
