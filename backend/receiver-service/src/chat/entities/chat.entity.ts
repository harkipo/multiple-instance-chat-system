import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Message } from '../../message/entities/message.entity';

@Entity('chats')
@ObjectType()
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  name: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  description?: string;

  @Column({ name: 'chat_type', default: 'group' })
  @Field()
  chatType: string; // 'direct' for 1:1 chats, 'group' for group chats

  @Column('jsonb', { name: 'participant_ids', default: [] })
  @Field(() => [String])
  participantIds: string[];

  @Column({ name: 'is_active', default: true })
  @Field()
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @OneToMany(() => Message, message => message.chat)
  @Field(() => [Message], { nullable: true })
  messages?: Message[];
}
