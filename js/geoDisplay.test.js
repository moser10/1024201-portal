import test from "node:test";
import assert from "node:assert/strict";
import { purityClass, shortPlace, formatNetSpeed, speedTone } from "./geoDisplay.js";

test("high purity is dark green and black is reserved for the worst scores", () => {
  assert.equal(purityClass(92), "g1");
  assert.equal(purityClass(88), "g1");
  assert.equal(purityClass(75), "g2");
  assert.equal(purityClass(60), "y1");
  assert.equal(purityClass(50), "y2");
  assert.equal(purityClass(35), "or");
  assert.equal(purityClass(20), "rd");
  assert.equal(purityClass(10), "bk");
  assert.equal(purityClass(undefined), "g1");
});

test("places collapse to city abbr plus country code", () => {
  assert.equal(shortPlace({ city: "Los Angeles", country: "US" }), "LA, US");
  assert.equal(shortPlace({ city: "北京", country: "CN" }), "BJ, CN");
  assert.equal(shortPlace({ city: "Beijing", country: "China" }), "BJ, CN");
  assert.equal(shortPlace({ city: "Tokyo", country: "JP" }), "Tokyo, JP");
  assert.equal(shortPlace({ city: "Osaka", country: "JP" }), "Osaka, JP");
  assert.equal(shortPlace({ city: "Someville", country: "DE" }), "Someville, DE");
});

test("speed tone is green/yellow/red by common-sense latency", () => {
  assert.equal(speedTone({ rttMs: 40 }), "fast");
  assert.equal(speedTone({ rttMs: 120 }), "ok");
  assert.equal(speedTone({ rttMs: 250 }), "slow");
  assert.equal(speedTone({ mbps: 40 }), "fast");
  assert.equal(speedTone({ mbps: 8 }), "ok");
  assert.equal(speedTone({ mbps: 2 }), "slow");
  assert.equal(speedTone({}), "");
});

test("speed prefers Mbps and falls back to RTT", () => {
  assert.equal(formatNetSpeed({ mbps: 12.4 }), "12M");
  assert.equal(formatNetSpeed({ mbps: 1.25 }), "1.3M");
  assert.equal(formatNetSpeed({ rttMs: 28.2 }), "28ms");
  assert.equal(formatNetSpeed({}), "—");
});
