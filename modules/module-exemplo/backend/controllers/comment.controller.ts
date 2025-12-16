import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { CommentService } from "../services/comment.service";
import { JwtAuthGuard } from "@core/common/guards/jwt-auth.guard";
import { CreateCommentDto } from "../dto/demo.dto";

/**
 * Controller de ComentÃ¡rios
 */
@Controller("api/demo/:demoId/comments")
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  async findAll(@Param("demoId") demoId: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.commentService.findAll(demoId, tenantId);
  }

  @Post()
  async create(
    @Param("demoId") demoId: string,
    @Body() dto: CreateCommentDto,
    @Req() req,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.commentService.create(demoId, dto, tenantId, userId);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.commentService.remove(id, tenantId, userId);
  }
}


