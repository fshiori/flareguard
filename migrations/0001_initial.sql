CREATE TABLE proxy_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES proxy_keys(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  constraints_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX grants_key_capability_resource_idx
ON grants (key_id, capability, resource_type, resource_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  key_id TEXT,
  endpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  resources_json TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  upstream_status INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
