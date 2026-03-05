import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PathsService } from './paths.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PathsService],
  exports: [PathsService],
})
export class PathsModule {}
