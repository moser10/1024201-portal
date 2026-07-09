import { ADDRESS_COUNTRIES, ADDRESS_CITIES, ADDRESS_LISTINGS } from "./addressSeed.js";

export async function ensureAddressSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS address_countries (
        code TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_zh TEXT NOT NULL,
        phone_cc TEXT NOT NULL,
        phone_trunk TEXT NOT NULL DEFAULT '',
        phone_mobile_prefixes TEXT NOT NULL DEFAULT '[]',
        postal_hint TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS address_cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country_code TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_local TEXT NOT NULL,
        lat REAL,
        lon REAL,
        postal_example TEXT NOT NULL DEFAULT '',
        UNIQUE(country_code, name_en)
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS address_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country_code TEXT NOT NULL,
        city_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        line1 TEXT NOT NULL,
        line2 TEXT NOT NULL DEFAULT '',
        district TEXT NOT NULL DEFAULT '',
        postal_code TEXT NOT NULL,
        full_address TEXT NOT NULL,
        phone_area TEXT NOT NULL DEFAULT '',
        phone_sample TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'seed',
        external_id TEXT NOT NULL,
        lat REAL,
        lon REAL,
        is_new INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        refreshed_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source, external_id)
      )`
    )
    .run();
  await db.prepare(`ALTER TABLE address_listings ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await db.prepare(`ALTER TABLE address_listings ADD COLUMN first_seen_at TEXT`).run().catch(() => {});
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_addr_list_country ON address_listings(country_code)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_addr_list_city ON address_listings(city_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_addr_list_postal ON address_listings(postal_code)`).run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS address_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    )
    .run();
}

function listingExternalId(row, cityName) {
  const slug = `${row.country}|${cityName}|${row.kind}|${row.line1}`.toLowerCase().replace(/\s+/g, "-");
  return slug.slice(0, 120);
}

function buildFullAddress(countryCode, cityName, row) {
  const parts = [row.line1, row.district, cityName, row.postal_code];
  if (countryCode === "US" || countryCode === "CA") parts.push(countryCode === "US" ? "USA" : "Canada");
  return parts.filter(Boolean).join(", ");
}

export async function seedAddressData(db) {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE address_listings SET is_new = 0 WHERE source = 'seed'`).run();
  for (const c of ADDRESS_COUNTRIES) {
    await db
      .prepare(
        `INSERT INTO address_countries (code, name_en, name_zh, phone_cc, phone_trunk, phone_mobile_prefixes, postal_hint, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           name_en=excluded.name_en, name_zh=excluded.name_zh, phone_cc=excluded.phone_cc,
           phone_trunk=excluded.phone_trunk, phone_mobile_prefixes=excluded.phone_mobile_prefixes,
           postal_hint=excluded.postal_hint, updated_at=excluded.updated_at`
      )
      .bind(
        c.code,
        c.name_en,
        c.name_zh,
        c.phone_cc,
        c.phone_trunk || "",
        JSON.stringify(c.phone_mobile_prefixes || []),
        c.postal_hint || "",
        now
      )
      .run();
  }

  const cityIdByKey = new Map();
  for (const city of ADDRESS_CITIES) {
    await db
      .prepare(
        `INSERT INTO address_cities (country_code, name_en, name_local, lat, lon, postal_example)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(country_code, name_en) DO UPDATE SET
           name_local=excluded.name_local, lat=excluded.lat, lon=excluded.lon, postal_example=excluded.postal_example`
      )
      .bind(city.country, city.name_en, city.name_local, city.lat, city.lon, city.postal_example)
      .run();
    const row = await db
      .prepare(`SELECT id FROM address_cities WHERE country_code = ? AND name_en = ?`)
      .bind(city.country, city.name_en)
      .first();
    if (row?.id) cityIdByKey.set(`${city.country}|${city.name_en}`, row.id);
  }

  for (const row of ADDRESS_LISTINGS) {
    const cityId = cityIdByKey.get(`${row.country}|${row.city}`);
    if (!cityId) continue;
    const externalId = listingExternalId(row, row.city);
    const full = buildFullAddress(row.country, row.city, row);
    await db
      .prepare(
        `INSERT INTO address_listings (
          country_code, city_id, kind, title, line1, district, postal_code, full_address,
          phone_area, phone_sample, source, external_id, is_new, first_seen_at, refreshed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, 1, ?, ?)
        ON CONFLICT(source, external_id) DO UPDATE SET
          title=excluded.title, line1=excluded.line1, district=excluded.district,
          postal_code=excluded.postal_code, full_address=excluded.full_address,
          phone_area=excluded.phone_area, phone_sample=excluded.phone_sample,
          refreshed_at=excluded.refreshed_at, is_new=0`
      )
      .bind(
        row.country,
        cityId,
        row.kind,
        row.title,
        row.line1,
        row.district || "",
        row.postal_code,
        full,
        row.phone_area || "",
        row.phone_sample || "",
        externalId,
        now,
        now
      )
      .run();
  }

  await db
    .prepare(`INSERT INTO address_meta (key, value) VALUES ('last_refresh', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(now)
    .run();

  const count = await db.prepare(`SELECT COUNT(*) AS n FROM address_listings`).first();
  await db
    .prepare(`INSERT INTO address_meta (key, value) VALUES ('listing_count', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(String(count?.n || 0))
    .run();
}

/** 可选：用 Google Geocoding 校验/补全坐标（需 env.GOOGLE_GEOCODING_API_KEY） */
async function enrichWithGoogleGeocode(env, db, limit = 5) {
  const key = env?.GOOGLE_GEOCODING_API_KEY?.trim();
  if (!key) return { enriched: 0, skipped: "no_api_key" };

  const rows = await db
    .prepare(`SELECT id, full_address FROM address_listings WHERE lat IS NULL OR lon IS NULL LIMIT ?`)
    .bind(limit)
    .all();
  let enriched = 0;
  for (const row of rows.results || []) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(row.full_address)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (!loc) continue;
    await db
      .prepare(`UPDATE address_listings SET lat = ?, lon = ? WHERE id = ?`)
      .bind(loc.lat, loc.lng, row.id)
      .run();
    enriched += 1;
  }
  return { enriched };
}

export async function refreshAddressData(db, env = {}) {
  await ensureAddressSchema(db);
  await seedAddressData(db);
  const geo = await enrichWithGoogleGeocode(env, db, 8);
  return { ok: true, geo };
}

export async function getAddressCountries(db) {
  const rows = await db
    .prepare(
      `SELECT code, name_en, name_zh, phone_cc, phone_trunk, phone_mobile_prefixes, postal_hint
       FROM address_countries ORDER BY name_en`
    )
    .all();
  return (rows.results || []).map((r) => ({
    ...r,
    phone_mobile_prefixes: JSON.parse(r.phone_mobile_prefixes || "[]"),
  }));
}

export async function getAddressCities(db, countryCode) {
  const rows = await db
    .prepare(
      `SELECT id, country_code, name_en, name_local, lat, lon, postal_example
       FROM address_cities WHERE country_code = ? ORDER BY name_en`
    )
    .bind(countryCode)
    .all();
  return rows.results || [];
}

export async function getAddressMeta(db) {
  const rows = await db.prepare(`SELECT key, value FROM address_meta`).all();
  const meta = {};
  for (const r of rows.results || []) meta[r.key] = r.value;
  const stats = await db
    .prepare(
      `SELECT country_code, kind, COUNT(*) AS n FROM address_listings GROUP BY country_code, kind`
    )
    .all();
  return { ...meta, stats: stats.results || [] };
}

export async function searchAddressListings(db, { country, cityId, kind, q, limit = 50, offset = 0 }) {
  const where = [];
  const binds = [];

  if (country) {
    where.push("l.country_code = ?");
    binds.push(country.toUpperCase());
  }
  if (cityId) {
    where.push("l.city_id = ?");
    binds.push(parseInt(cityId, 10));
  }
  if (kind && (kind === "rent" || kind === "sale")) {
    where.push("l.kind = ?");
    binds.push(kind);
  }
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    where.push("(l.full_address LIKE ? OR l.postal_code LIKE ? OR l.title LIKE ? OR l.district LIKE ? OR c.name_en LIKE ?)");
    binds.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM address_listings l
       LEFT JOIN address_cities c ON c.id = l.city_id ${whereSql}`
    )
    .bind(...binds)
    .first();

  binds.push(limit, offset);
  const rows = await db
    .prepare(
      `SELECT l.id, l.country_code, l.city_id, l.kind, l.title, l.line1, l.district,
              l.postal_code, l.full_address, l.phone_area, l.phone_sample, l.lat, l.lon,
              l.is_new, l.refreshed_at, c.name_en AS city_name, c.name_local AS city_local,
              co.name_en AS country_name, co.name_zh AS country_zh,
              co.phone_cc, co.phone_trunk, co.phone_mobile_prefixes, co.postal_hint
       FROM address_listings l
       LEFT JOIN address_cities c ON c.id = l.city_id
       LEFT JOIN address_countries co ON co.code = l.country_code
       ${whereSql}
       ORDER BY l.country_code, c.name_en, l.kind, l.title
       LIMIT ? OFFSET ?`
    )
    .bind(...binds)
    .all();

  const results = (rows.results || []).map((r) => ({
    id: r.id,
    country_code: r.country_code,
    country_name: r.country_name,
    country_zh: r.country_zh,
    city_id: r.city_id,
    city_name: r.city_name,
    city_local: r.city_local,
    kind: r.kind,
    title: r.title,
    line1: r.line1,
    district: r.district,
    postal_code: r.postal_code,
    full_address: r.full_address,
    phone_area: r.phone_area,
    phone_sample: r.phone_sample,
    phone_cc: r.phone_cc,
    phone_trunk: r.phone_trunk,
    phone_mobile_prefixes: JSON.parse(r.phone_mobile_prefixes || "[]"),
    postal_hint: r.postal_hint,
    lat: r.lat,
    lon: r.lon,
    is_new: !!r.is_new,
    refreshed_at: r.refreshed_at,
  }));

  return {
    total: countRow?.n || 0,
    limit,
    offset,
    results,
  };
}

export async function ensureAddressReady(db, env, { waitUntil } = {}) {
  await ensureAddressSchema(db);
  const row = await db.prepare(`SELECT value FROM address_meta WHERE key = 'listing_count'`).first();
  const empty = !row?.value || parseInt(row.value, 10) === 0;
  if (empty && typeof waitUntil === "function") {
    waitUntil(refreshAddressData(db, env).catch((e) => console.error("address background refresh failed", e)));
  }
  return { ready: !empty };
}
