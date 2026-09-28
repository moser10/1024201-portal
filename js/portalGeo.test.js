import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clientIpFromPing, geoNeedsFullLookup, GEO_HEARTBEAT_MS } from "./portalGeo.js";

test("full IP intel runs only when the visible address changed", () => {
  assert.equal(geoNeedsFullLookup("1.1.1.1", "1.1.1.1"), false);
  assert.equal(geoNeedsFullLookup("1.1.1.1", "8.8.8.8"), true);
  assert.equal(geoNeedsFullLookup("", "8.8.8.8"), true);
  assert.equal(geoNeedsFullLookup("1.1.1.1", ""), false);
});

test("ping payload exposes a real client IP when present", () => {
  assert.equal(clientIpFromPing({ ok: true, ip: "203.0.113.9" }), "203.0.113.9");
  assert.equal(clientIpFromPing({ ok: true, ip: "0.0.0.0" }), "");
  assert.equal(GEO_HEARTBEAT_MS, 60_000);
});

test("portal ping returns IP and the home page only does a full geo lookup after a change", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const portal = readFileSync(join(dir, "../functions/api/portal.js"), "utf8");
  const home = readFileSync(join(dir, "../index.html"), "utf8");
  assert.match(portal, /ip: clientIp\(request\)/);
  assert.match(home, /checkIpHeartbeat/);
  assert.match(home, /geoNeedsFullLookup/);
});
