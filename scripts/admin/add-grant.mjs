#!/usr/bin/env node
import {
  executeRemoteSql,
  optionalArg,
  parseArgs,
  randomId,
  requireArg,
  sqlString
} from "./common.mjs";

try {
  const args = parseArgs(process.argv.slice(2));
  const keyId = requireArg(args, "key-id");
  const capability = requireArg(args, "capability");
  const resourceType = requireArg(args, "resource-type");
  const resourceId = requireArg(args, "resource-id");
  const constraints = optionalArg(args, "constraints") ?? "{}";
  const config = optionalArg(args, "config") ?? "wrangler.production.toml";

  JSON.parse(constraints);

  const grantId = randomId("grant");
  const sql = `INSERT INTO grants (id, key_id, capability, resource_type, resource_id, constraints_json)
VALUES (${sqlString(grantId)}, ${sqlString(keyId)}, ${sqlString(capability)}, ${sqlString(resourceType)}, ${sqlString(resourceId)}, ${sqlString(constraints)});
`;

  executeRemoteSql(sql, config);

  console.log("");
  console.log(`Grant created: ${grantId}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
