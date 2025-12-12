import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  // GET /modules - Listar todos os módulos disponíveis
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findAll() {
    return this.modulesService.findAll();
  }

  // GET /modules/:name/config - Obter configuração de um módulo
  @Get(':name/config')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findOne(@Param('name') name: string) {
    return this.modulesService.findOne(name);
  }

  // POST /modules - Criar um novo módulo (apenas SUPER_ADMIN)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() createModuleDto: {
    name: string;
    displayName: string;
    description?: string;
    version?: string;
    config?: any;
  }) {
    return this.modulesService.create(createModuleDto);
  }

  // PUT /modules/:name - Atualizar um módulo (apenas SUPER_ADMIN)
  @Put(':name')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('name') name: string,
    @Body() updateModuleDto: {
      displayName?: string;
      description?: string;
      version?: string;
      config?: any;
      isActive?: boolean;
    }
  ) {
    return this.modulesService.update(name, updateModuleDto);
  }

  // DELETE /modules/:name - Deletar um módulo (apenas SUPER_ADMIN)
  @Delete(':name')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('name') name: string) {
    await this.modulesService.remove(name);
  }
}