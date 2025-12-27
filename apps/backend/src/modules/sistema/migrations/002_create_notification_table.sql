-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Tabela de Agendamento de Notificações
-- Data: 2025-12-27
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mod_sistema_notification_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    audience VARCHAR(50) DEFAULT 'all',
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mod_sistema_notif_enabled ON mod_sistema_notification_schedules(enabled);
