import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UnreadCountUpdate {
  @Field(() => ID)
  chatId: string;

  @Field()
  userId: string;

  @Field()
  unreadCount: number;
}
