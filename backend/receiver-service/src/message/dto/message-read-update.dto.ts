import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class MessageReadUpdate {
  @Field(() => ID)
  messageId: string;

  @Field()
  userId: string;

  @Field()
  readAt: Date;
}

