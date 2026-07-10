import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function wranglerBin(root = process.cwd()) {
  const local = join(root, "node_modules", ".bin", "wrangler");
  return existsSync(local) ? local : "wrangler";
}

/** Run wrangler CLI; throws with stdout/stderr on failure. */
export function wranglerExec(args, opts = {}) {
  const root = opts.cwd || process.cwd();
  const bin = wranglerBin(root);
  const cmd = `${JSON.stringify(bin)} ${args}`;
  try {
    return execSync(cmd, {
      stdio: opts.inherit ? "inherit" : "pipe",
      encoding: opts.inherit ? undefined : "utf8",
      cwd: root,
      env: { ...process.env, WRANGLER_CI: "1", ...opts.env },
    });
  } catch (e) {
    const detail = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
    const err = new Error(detail || e.message || "wrangler failed");
    err.status = e.status;
    throw err;
  }
}
