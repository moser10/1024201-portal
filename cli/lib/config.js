import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_PATH = path.join(os.homedir(), ".config", "1024", "config.json");
const LEGACY_PATH = path.join(os.homedir(), ".1024", "credentials");

export const VERSION = "1.2.0";
export const DEFAULT_API_BASE = "https://1024201.com";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function loadConfig() {
  const primary = readJson(CONFIG_PATH);
  if (primary) return { ...primary, api_base: primary.api_base || DEFAULT_API_BASE };
  const legacy = readJson(LEGACY_PATH);
  if (legacy) return { ...legacy, api_base: legacy.api_base || DEFAULT_API_BASE };
  return { api_base: DEFAULT_API_BASE };
}

export function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function clearAuth() {
  const cfg = loadConfig();
  delete cfg.token;
  delete cfg.user_id;
  delete cfg.username;
  saveConfig(cfg);
}

export function configPath() {
  return CONFIG_PATH;
}
