import { AvailablePermission } from '../interfaces/permission.interface';

export const AVAILABLE_PERMISSIONS: AvailablePermission[] = [
  {
    resource: 'dashboard',
    label: 'Dashboard',
    actions: [
      { action: 'view', label: 'Visualizar dashboard' },
      { action: 'view_statistics', label: 'Visualizar estatisticas' },
    ],
  },
  {
    resource: 'orders',
    label: 'Ordens de servico',
    actions: [
      { action: 'view', label: 'Listar ordens' },
      { action: 'view_details', label: 'Visualizar detalhes da ordem' },
      { action: 'create', label: 'Criar ordem' },
      { action: 'edit', label: 'Editar ordem' },
      { action: 'change_status', label: 'Alterar status da ordem' },
      { action: 'view_history', label: 'Visualizar historico da ordem' },
    ],
  },
  {
    resource: 'clients',
    label: 'Clientes',
    actions: [
      { action: 'view', label: 'Listar clientes' },
      { action: 'view_details', label: 'Visualizar detalhes do cliente' },
      { action: 'create', label: 'Criar cliente' },
      { action: 'edit', label: 'Editar cliente' },
      { action: 'upload_images', label: 'Enviar imagens de clientes' },
    ],
  },
  {
    resource: 'products',
    label: 'Produtos',
    actions: [
      { action: 'view', label: 'Listar produtos' },
      { action: 'create', label: 'Criar produto' },
      { action: 'edit', label: 'Editar produto' },
      { action: 'upload_images', label: 'Enviar imagens de produtos' },
    ],
  },
  {
    resource: 'config',
    label: 'Configuracoes',
    actions: [
      { action: 'view', label: 'Visualizar configuracoes' },
      { action: 'edit', label: 'Editar configuracoes' },
      { action: 'manage_permissions', label: 'Gerenciar permissoes' },
    ],
  },
];
