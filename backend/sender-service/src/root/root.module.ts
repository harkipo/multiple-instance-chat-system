import { Module } from '@nestjs/common';
import { RootResolver } from './root.resolver';

@Module({
  providers: [RootResolver],
})
export class RootModule {}
