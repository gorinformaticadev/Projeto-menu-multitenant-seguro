import { Module } from '@nestjs/common';
import { DemoController } from './controllers/demo.controller';
import { CategoryController } from './controllers/category.controller';
import { TagController } from './controllers/tag.controller';
import { CommentController } from './controllers/comment.controller';
import { DemoService } from './services/demo.service';
import { CategoryService } from './services/category.service';
import { TagService } from './services/tag.service';
import { CommentService } from './services/comment.service';
import { PrismaModule } from '../../../backend/src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    DemoController,
    CategoryController,
    TagController,
    CommentController,
  ],
  providers: [DemoService, CategoryService, TagService, CommentService],
  exports: [DemoService, CategoryService, TagService, CommentService],
})
export class DemoModule {}
