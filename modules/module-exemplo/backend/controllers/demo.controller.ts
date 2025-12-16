import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { DemoService } from '../services/demo.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { CreateDemoDto, UpdateDemoDto, FilterDemoDto } from '../dto/demo.dto';

@Controller('api/demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get()
  async findAll(@Query() filters: FilterDemoDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.findAll(tenantId, filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.findOne(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async create(@Body() createDemoDto: CreateDemoDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.demoService.create(createDemoDto, tenantId, userId);
  }

  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() updateDemoDto: UpdateDemoDto, @Req() req) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.demoService.update(id, updateDemoDto, tenantId, userId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.remove(id, tenantId);
  }

  @Post(':id/publish')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async publish(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.demoService.publish(id, tenantId, userId);
  }

  @Post(':id/like')
  async like(@Param('id') id: string, @Req() req) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    return this.demoService.like(id, tenantId, userId);
  }

  @Get('categories/all')
  async getCategories(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.getCategories(tenantId);
  }

  @Get('tags/all')
  async getTags(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.getTags(tenantId);
  }

  @Get('stats/summary')
  async getStats(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.demoService.getStats(tenantId);
  }
}


