 import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@core/prisma/prisma.module';
import { ValidatorsModule } from '@core/common/validators/validators.module';

@Module({
  imports: [PrismaModule, ValidatorsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {
      // Empty implementation
    }


