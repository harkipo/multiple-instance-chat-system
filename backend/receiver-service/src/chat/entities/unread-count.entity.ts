import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Entity('unread_counts')
@Unique(['chatId', 'userId'])
@ObjectType()
export class UnreadCount {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'chat_id' })
  @Field(() => ID)
  chatId: string;

  @Column({ name: 'user_id' })
  @Field()
  userId: string;

  @Column({ name: 'unread_count', default: 0 })
  @Field()
  unreadCount: number;

  @CreateDateColumn({ name: 'created_at' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field(() => Date)
  updatedAt: Date;
}
