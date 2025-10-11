import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Chat } from '../../chat/entities/chat.entity';

@Entity('messages')
@ObjectType()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  content: string;

  @Column({ name: 'sender_id' })
  @Field()
  senderId: string;

  @Column({ name: 'chat_id' })
  @Field()
  chatId: string;

  @Column({ name: 'is_edited', default: false })
  @Field()
  isEdited: boolean;

  @Column({ name: 'edited_at', nullable: true })
  @Field(() => Date, { nullable: true })
  editedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  @Field(() => Date)
  createdAt: Date;

  @ManyToOne(() => Chat, chat => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  @Field(() => Chat)
  chat: Chat;
}
