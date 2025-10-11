import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class RootResolver {
  @Query(() => String, { name: 'health' })
  health(): string {
    return 'Sender Service is healthy';
  }
}
