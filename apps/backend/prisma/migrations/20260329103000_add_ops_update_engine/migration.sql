CREATE SCHEMA IF NOT EXISTS ops_update;

CREATE TABLE IF NOT EXISTS ops_update.executions (
  id UUID PRIMARY KEY,
  installation_id TEXT NOT NULL,
  requested_by TEXT NULL,
  source TEXT NOT NULL CHECK (source IN ('panel', 'terminal', 'system')),
  mode TEXT NOT NULL CHECK (mode IN ('native', 'docker')),
  current_version TEXT NOT NULL,
  target_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'running', 'completed', 'failed', 'rollback')),
  current_step TEXT NOT NULL,
  failed_step TEXT NULL,
  rollback_policy TEXT NOT NULL CHECK (rollback_policy IN ('code_only_safe', 'restore_required', 'manual_only')),
  progress_units_done INTEGER NOT NULL DEFAULT 0 CHECK (progress_units_done >= 0),
  progress_units_total INTEGER NOT NULL DEFAULT 0 CHECK (progress_units_total >= 0),
  error_json JSONB NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_update_executions_installation_requested_at
  ON ops_update.executions (installation_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_update_executions_status
  ON ops_update.executions (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_update_executions_active_installation
  ON ops_update.executions (installation_id)
  WHERE status IN ('requested', 'running', 'rollback');

CREATE TABLE IF NOT EXISTS ops_update.step_runs (
  id UUID PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES ops_update.executions(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  ordinal SMALLINT NOT NULL CHECK (ordinal > 0),
  attempt SMALLINT NOT NULL DEFAULT 1 CHECK (attempt > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  progress_units_done INTEGER NOT NULL DEFAULT 0 CHECK (progress_units_done >= 0),
  progress_units_total INTEGER NOT NULL DEFAULT 0 CHECK (progress_units_total >= 0),
  result_json JSONB NULL,
  error_json JSONB NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_update_step_runs_execution_ordinal
  ON ops_update.step_runs (execution_id, ordinal);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_update_step_runs_attempt
  ON ops_update.step_runs (execution_id, step, attempt);

CREATE TABLE IF NOT EXISTS ops_update.command_runs (
  id UUID PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES ops_update.executions(id) ON DELETE CASCADE,
  step_run_id UUID NULL REFERENCES ops_update.step_runs(id) ON DELETE SET NULL,
  command TEXT NOT NULL,
  args_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cwd TEXT NULL,
  exit_code INTEGER NULL,
  stdout_path TEXT NULL,
  stderr_path TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_update_command_runs_execution
  ON ops_update.command_runs (execution_id, started_at);

CREATE TABLE IF NOT EXISTS ops_update.env_snapshots (
  id UUID PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES ops_update.executions(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('backend', 'frontend_runtime', 'docker', 'release_runtime')),
  schema_version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  content_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_update_env_snapshots_execution
  ON ops_update.env_snapshots (execution_id, scope);

CREATE TABLE IF NOT EXISTS ops_update.release_snapshots (
  id UUID PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES ops_update.executions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('current_release', 'previous_release', 'target_release', 'current_images', 'previous_images')),
  ref TEXT NOT NULL,
  version TEXT NULL,
  digest_json JSONB NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_update_release_snapshots_execution
  ON ops_update.release_snapshots (execution_id, kind);

CREATE TABLE IF NOT EXISTS ops_update.runner_leases (
  installation_id TEXT PRIMARY KEY,
  runner_id TEXT NOT NULL,
  lease_token TEXT NOT NULL,
  execution_id UUID NULL REFERENCES ops_update.executions(id) ON DELETE SET NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
