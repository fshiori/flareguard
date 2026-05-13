import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    values[key] = value;
    index += 1;
  }
  return values;
}

export function requireArg(values, key) {
  const value = values[key];
  if (!value) {
    throw new Error(`missing required argument --${key}`);
  }
  return value;
}

export function optionalArg(values, key) {
  return values[key] || null;
}

export function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function randomId(prefix, bytes = 12) {
  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}

export function randomSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret) {
  return `sha256:${createHash("sha256").update(secret).digest("hex")}`;
}

export function executeRemoteSql(sql, config = "wrangler.production.toml") {
  const dir = mkdtempSync(join(tmpdir(), "flareguard-admin-"));
  const file = join(dir, "query.sql");
  writeFileSync(file, sql);

  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "flareguard", "--remote", "--config", config, "--file", file],
    { stdio: "inherit" }
  );
}
