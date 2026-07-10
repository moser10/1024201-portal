/**
 * Build address seed SQL (shared by warm + predeploy checks).
 */
import { ADDRESS_COUNTRIES, ADDRESS_CITIES, ADDRESS_LISTINGS } from "../functions/api/addressSeed.js";

export const ADDRESS_DB = "one-sentence-novel";

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
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

/** Schema + seed statements for D1 (idempotent). */
export function buildAddressSeedStatements(nowIso = new Date().toISOString()) {
  const now = esc(nowIso);
  const lines = [];

  lines.push(
    `CREATE TABLE IF NOT EXISTS address_countries (
      code TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      phone_cc TEXT NOT NULL,
      phone_trunk TEXT NOT NULL DEFAULT '',
      phone_mobile_prefixes TEXT NOT NULL DEFAULT '[]',
      postal_hint TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`
  );
  lines.push(
    `CREATE TABLE IF NOT EXISTS address_cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_local TEXT NOT NULL,
      lat REAL,
      lon REAL,
      postal_example TEXT NOT NULL DEFAULT '',
      UNIQUE(country_code, name_en)
    );`
  );
  lines.push(
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
    );`
  );
  lines.push(`CREATE INDEX IF NOT EXISTS idx_addr_list_country ON address_listings(country_code);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_addr_list_city ON address_listings(city_id);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_addr_list_postal ON address_listings(postal_code);`);
  lines.push(
    `CREATE TABLE IF NOT EXISTS address_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`
  );

  lines.push(`UPDATE address_listings SET is_new = 0 WHERE source = 'seed';`);

  for (const c of ADDRESS_COUNTRIES) {
    lines.push(
      `INSERT INTO address_countries (code, name_en, name_zh, phone_cc, phone_trunk, phone_mobile_prefixes, postal_hint, updated_at)
       VALUES ('${esc(c.code)}', '${esc(c.name_en)}', '${esc(c.name_zh)}', '${esc(c.phone_cc)}', '${esc(c.phone_trunk || "")}',
               '${esc(JSON.stringify(c.phone_mobile_prefixes || []))}', '${esc(c.postal_hint || "")}', '${now}')
       ON CONFLICT(code) DO UPDATE SET name_en=excluded.name_en, name_zh=excluded.name_zh, phone_cc=excluded.phone_cc,
         phone_trunk=excluded.phone_trunk, phone_mobile_prefixes=excluded.phone_mobile_prefixes,
         postal_hint=excluded.postal_hint, updated_at=excluded.updated_at;`
    );
  }

  for (const city of ADDRESS_CITIES) {
    lines.push(
      `INSERT INTO address_cities (country_code, name_en, name_local, lat, lon, postal_example)
       VALUES ('${esc(city.country)}', '${esc(city.name_en)}', '${esc(city.name_local)}', ${city.lat ?? "NULL"}, ${city.lon ?? "NULL"}, '${esc(city.postal_example)}')
       ON CONFLICT(country_code, name_en) DO UPDATE SET name_local=excluded.name_local, lat=excluded.lat, lon=excluded.lon, postal_example=excluded.postal_example;`
    );
  }

  for (const row of ADDRESS_LISTINGS) {
    const externalId = esc(listingExternalId(row, row.city));
    const full = esc(buildFullAddress(row.country, row.city, row));
    lines.push(
      `INSERT INTO address_listings (
        country_code, city_id, kind, title, line1, district, postal_code, full_address,
        phone_area, phone_sample, source, external_id, is_new, first_seen_at, refreshed_at
      )
      SELECT '${esc(row.country)}', c.id, '${esc(row.kind)}', '${esc(row.title)}', '${esc(row.line1)}', '${esc(row.district || "")}',
             '${esc(row.postal_code)}', '${full}', '${esc(row.phone_area || "")}', '${esc(row.phone_sample || "")}',
             'seed', '${externalId}', 1, '${now}', '${now}'
      FROM address_cities c WHERE c.country_code = '${esc(row.country)}' AND c.name_en = '${esc(row.city)}'
      ON CONFLICT(source, external_id) DO UPDATE SET
        title=excluded.title, line1=excluded.line1, district=excluded.district,
        postal_code=excluded.postal_code, full_address=excluded.full_address,
        phone_area=excluded.phone_area, phone_sample=excluded.phone_sample,
        refreshed_at=excluded.refreshed_at, is_new=0;`
    );
  }

  lines.push(
    `INSERT INTO address_meta (key, value) VALUES ('last_refresh', '${now}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;`
  );
  lines.push(
    `INSERT INTO address_meta (key, value) VALUES ('listing_count', (SELECT COUNT(*) FROM address_listings)) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`
  );

  return lines;
}

export function chunkStatements(statements, size = 40) {
  const chunks = [];
  for (let i = 0; i < statements.length; i += size) {
    chunks.push(statements.slice(i, i + size));
  }
  return chunks;
}
