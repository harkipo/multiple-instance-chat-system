import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Message } from './message.entity';

@Entity('message_reads')
@ObjectType()
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'message_id' })
  @Field()
  messageId: string;

  @Column({ name: 'user_id' })
  @Field()
  userId: string;

  @CreateDateColumn({ name: 'read_at' })
  @Field(() => Date)
  readAt: Date;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'message_id' })
  message: Message;
}

