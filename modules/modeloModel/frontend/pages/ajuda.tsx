"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AjudaPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sobre o Sistema</h1>
        <p className="text-muted-foreground mt-2">
          Informações sobre o projeto e suas tecnologias
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Descrição do Projeto</CardTitle>
            <CardDescription>
              Sistema multitenant seguro com isolamento de dados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              Este é um sistema multitenant seguro com isolamento de dados e controle de acesso 
              baseado em roles (RBAC). O sistema foi desenvolvido para proporcionar segurança, 
              escalabilidade e facilidade de uso para diferentes tipos de organizações.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tecnologias Utilizadas</CardTitle>
            <CardDescription>
              Stack tecnológico do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">NestJS</Badge>
              <Badge variant="secondary">Next.js</Badge>
              <Badge variant="secondary">PostgreSQL</Badge>
              <Badge variant="secondary">Prisma ORM</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">Radix UI</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Características Principais</CardTitle>
            <CardDescription>
              Funcionalidades e recursos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>Autenticação JWT com Bcrypt</li>
              <li>Controle de acesso baseado em roles (RBAC)</li>
              <li>Isolamento de dados por tenant</li>
              <li>Sistema de módulos plug-and-play</li>
              <li>Interface responsiva com Tailwind CSS</li>
              <li>Componentes acessíveis com Radix UI</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}