import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../core/backend/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../core/backend/src/common/guards/roles.guard';

@Controller('ajuda')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AjudaController {
  @Get()
  getSobre() {
    return {
      titulo: "Sobre o Sistema",
      descricao: "Este é um sistema multitenant seguro com isolamento de dados e controle de acesso baseado em roles (RBAC).",
      versao: "1.0.0",
      tecnologias: [
        "NestJS",
        "Next.js",
        "PostgreSQL",
        "Prisma ORM",
        "Tailwind CSS",
        "Radix UI"
      ]
    };
  }
}