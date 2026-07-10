/**
 * Apply address seed to remote D1 in batches (avoids single huge --file failures).
 */
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { wranglerExec } from "./_wrangler.mjs";
import { ADDRESS_DB, buildAddressSeedStatements, chunkStatements } from "./address-seed-sql.mjs";

const root = process.cwd();
const BATCH_SIZE = 40;

const COLUMN_MIGRATIONS = [
  `ALTER TABLE address_listings ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE address_listings ADD COLUMN first_seen_at TEXT`,
];

function ensureAddressColumns() {
  for (const sql of COLUMN_MIGRATIONS) {
    try {
      wranglerExec(`d1 execute ${ADDRESS_DB} --remote --yes --command=${JSON.stringify(sql)}`, { cwd: root });
    } catch {
      /* column already exists */
    }
  }
}

export function warmAddressRemote() {
  const statements = buildAddressSeedStatements();
  const chunks = chunkStatements(statements, BATCH_SIZE);
  const tmp = mkdtempSync(join(tmpdir(), "address-seed-"));

  console.log(`address-warm: ${statements.length} statements in ${chunks.length} batch(es)`);

  ensureAddressColumns();

  try {
    for (let i = 0; i < chunks.length; i++) {
      const file = join(tmp, `batch-${i}.sql`);
      writeFileSync(file, chunks[i].join("\n"));
      console.log(`address-warm: batch ${i + 1}/${chunks.length} …`);
      wranglerExec(`d1 execute ${ADDRESS_DB} --remote --yes --file=${JSON.stringify(file)}`, { cwd: root, inherit: true });
      unlinkSync(file);
    }
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  console.log("address-warm: done");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    warmAddressRemote();
  } catch (e) {
    console.error("address-warm failed:", e.message);
    console.error("Check API token has Account → D1 → Edit. See https://dash.cloudflare.com/profile/api-tokens");
    process.exit(1);
  }
}
