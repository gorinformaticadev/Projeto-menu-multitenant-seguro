import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../core/backend/src/prisma/prisma.service';

@Injectable()
export class AjudaService {
  constructor(private prisma: PrismaService) {}

  getSobreInfo() {
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