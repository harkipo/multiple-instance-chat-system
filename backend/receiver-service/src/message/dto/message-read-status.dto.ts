import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class MessageReadUser {
  @Field()
  userId: string;

  @Field()
  readAt: Date;
}

@ObjectType()
export class MessageReadStatus {
  @Field(() => ID)
  messageId: string;

  @Field(() => Int)
  totalParticipants: number;

  @Field(() => Int)
  readByCount: number;

  @Field()
  isFullyRead: boolean;

  @Field(() => [MessageReadUser])
  readByUsers: MessageReadUser[];
}

