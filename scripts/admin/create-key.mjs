#!/usr/bin/env node
import {
  executeRemoteSql,
  hashSecret,
  optionalArg,
  parseArgs,
  randomId,
  randomSecret,
  requireArg,
  sqlString
} from "./common.mjs";

try {
  const args = parseArgs(process.argv.slice(2));
  const name = requireArg(args, "name");
  const accountId = requireArg(args, "account-id");
  const expiresAt = optionalArg(args, "expires-at");
  const config = optionalArg(args, "config") ?? "wrangler.production.toml";

  const keyId = randomId("fgk");
  const secret = randomSecret();
  const secretHash = hashSecret(secret);

  const expiresSql = expiresAt ? sqlString(expiresAt) : "NULL";
  const sql = `INSERT INTO proxy_keys (id, name, account_id, secret_hash, status, expires_at)
VALUES (${sqlString(keyId)}, ${sqlString(name)}, ${sqlString(accountId)}, ${sqlString(secretHash)}, 'active', ${expiresSql});
`;

  executeRemoteSql(sql, config);

  console.log("");
  console.log("Proxy key created. Store this value now; it will not be shown again.");
  console.log(`${keyId}.${secret}`);
  console.log("");
  console.log(`Key ID: ${keyId}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
