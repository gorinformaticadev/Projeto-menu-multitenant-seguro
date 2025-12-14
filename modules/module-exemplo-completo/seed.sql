-- Seed de dados para o módulo exemplo completo
-- Data: 2025-12-14
-- Versão: 1.0.0

-- Inserir dados de exemplo na tabela module_exemplo_data
INSERT INTO module_exemplo_data (name, description, value, tenant_id) VALUES
('Item Exemplo 1', 'Primeiro item de exemplo do módulo', 100.50, NULL),
('Item Exemplo 2', 'Segundo item de exemplo do módulo', 250.75, NULL),
('Item Exemplo 3', 'Terceiro item de exemplo do módulo', 75.25, NULL),
('Configuração Inicial', 'Configuração padrão do módulo', 0.00, NULL),
('Dados de Teste', 'Dados de teste para validação', 999.99, NULL);

-- Configurações padrão do módulo
INSERT INTO module_exemplo_data (name, description, value, tenant_id) VALUES
('max_items_limit', 'Limite máximo de itens configurado', 1000.00, NULL),
('enable_notifications', 'Habilitar notificações do módulo', 1.00, NULL),
('maintenance_mode', 'Modo de manutenção desabilitado', 0.00, NULL);