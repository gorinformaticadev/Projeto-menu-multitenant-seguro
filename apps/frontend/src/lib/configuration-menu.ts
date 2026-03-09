export interface ConfigurationMenuItemDefinition {
  id: string;
  name: string;
  href: string;
  icon: string;
  description: string;
  order: number;
  show: (role?: string) => boolean;
}

const configurationMenuDefinitions: ConfigurationMenuItemDefinition[] = [
  {
    id: "configuracoes-visao-geral",
    name: "Visão Geral",
    href: "/configuracoes",
    icon: "Settings",
    description: "Configurações gerais do sistema",
    order: 1,
    show: () => true,
  },
  {
    id: "configuracoes-seguranca",
    name: "Segurança",
    href: "/configuracoes/seguranca",
    icon: "Shield",
    description: "Políticas de segurança e autenticação",
    order: 2,
    show: (role) => role === "SUPER_ADMIN",
  },
  {
    id: "configuracoes-identidade",
    name: "Identidade da Plataforma",
    href: "/configuracoes/identidade",
    icon: "Building2",
    description: "Informações básicas da plataforma",
    order: 3,
    show: (role) => role === "SUPER_ADMIN",
  },
  {
    id: "configuracoes-notificacoes-push",
    name: "Notificações Push",
    href: "/configuracoes/notificacoes-push",
    icon: "BellRing",
    description: "Chaves VAPID para PWA/Windows",
    order: 4,
    show: (role) => role === "SUPER_ADMIN",
  },
  {
    id: "configuracoes-modulos",
    name: "Gerenciamento de Módulos",
    href: "/configuracoes/sistema/modulos",
    icon: "Package",
    description: "Instalar e gerenciar módulos",
    order: 5,
    show: (role) => role === "SUPER_ADMIN",
  },
  {
    id: "configuracoes-diagnostico",
    name: "Diagnostico Operacional",
    href: "/configuracoes/sistema/diagnostico",
    icon: "Activity",
    description: "Visao unificada de saude, tarefas, alertas e auditoria",
    order: 6,
    show: (role) => role === "SUPER_ADMIN" || role === "ADMIN",
  },
  {
    id: "configuracoes-updates",
    name: "Sistema de Updates",
    href: "/configuracoes/sistema/updates",
    icon: "Download",
    description: "Atualizações automáticas via Git",
    order: 7,
    show: (role) => role === "SUPER_ADMIN",
  },
  {
    id: "configuracoes-empresa",
    name: "Configurações da Empresa",
    href: "/configuracoes/empresa",
    icon: "Building2",
    description: "Informações da empresa",
    order: 8,
    show: (role) => role === "ADMIN",
  },
  {
    id: "configuracoes-cron",
    name: "Agendamento de Tarefas",
    href: "/configuracoes/sistema/cron",
    icon: "Clock",
    description: "Gerenciar tarefas agendadas e cronogramas",
    order: 9,
    show: (role) => role === "SUPER_ADMIN",
  },
];

export function getConfigurationPanelItems(role?: string) {
  return configurationMenuDefinitions.filter((item) => item.show(role));
}
