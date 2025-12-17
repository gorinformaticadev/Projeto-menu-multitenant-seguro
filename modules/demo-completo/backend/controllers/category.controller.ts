import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CategoryService } from '../services/category.service';
import { JwtAuthGuard } from '../../../../../backend/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../backend/src/common/guards/roles.guard';
import { Roles } from '../../../../../backend/src/common/decorators/roles.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/demo.dto';

@Controller('api/demo/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Get()
  async findAll(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.categoryService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.categoryService.findOne(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async create(@Body() dto: CreateCategoryDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.categoryService.create(dto, tenantId);
  }

  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.categoryService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.categoryService.remove(id, tenantId);
  }
}
