"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AjudaPage() {
  const t = useTranslations("Ajuda");

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t("titulo")}</CardTitle>
          <CardDescription>{t("descricao")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">{t("sobre_sistema.titulo")}</h2>
              <p className="text-muted-foreground">
                {t("sobre_sistema.descricao")}
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">{t("funcionalidades.titulo")}</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>{t("funcionalidades.autenticacao")}</li>
                <li>{t("funcionalidades.multitenant")}</li>
                <li>{t("funcionalidades.rbac")}</li>
                <li>{t("funcionalidades.modularidade")}</li>
                <li>{t("funcionalidades.seguranca")}</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">{t("tecnologias.titulo")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">{t("tecnologias.backend")}</h3>
                  <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                    <li>NestJS 11</li>
                    <li>PostgreSQL</li>
                    <li>Prisma ORM</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">{t("tecnologias.frontend")}</h3>
                  <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                    <li>Next.js 14</li>
                    <li>TypeScript</li>
                    <li>Tailwind CSS</li>
                    <li>Radix UI</li>
                  </ul>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">{t("seguranca.titulo")}</h2>
              <p className="text-muted-foreground mb-3">
                {t("seguranca.descricao")}
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>{t("seguranca.jwt")}</li>
                <li>{t("seguranca.bcrypt")}</li>
                <li>{t("seguranca.cors")}</li>
                <li>{t("seguranca.validacao")}</li>
                <li>{t("seguranca.isolamento")}</li>
              </ul>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}