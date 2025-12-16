import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { TagService } from "../services/tag.service";
import { JwtAuthGuard } from "../../../../backend/src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../backend/src/common/guards/roles.guard";
import { Roles } from "../../../../backend/src/common/decorators/roles.decorator";
import { CreateTagDto } from "../dto/demo.dto";

/**
 * Controller de Tags
 */
@Controller("api/demo/tags")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  async findAll(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.tagService.findAll(tenantId);
  }

  @Get("popular")
  async getPopular(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.tagService.getPopular(tenantId);
  }

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN")
  async create(@Body() dto: CreateTagDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.tagService.create(dto, tenantId);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  async remove(@Param("id") id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.tagService.remove(id, tenantId);
  }
}
