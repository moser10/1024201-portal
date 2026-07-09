/**
 * Generate address-seed.sql and apply to remote D1 via wrangler --file.
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { ADDRESS_COUNTRIES, ADDRESS_CITIES, ADDRESS_LISTINGS } from "../functions/api/addressSeed.js";

const DB = "one-sentence-novel";
const root = process.cwd();
const sqlPath = `${root}/scripts/.address-seed.sql`;

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

const now = esc(new Date().toISOString());
const lines = [];

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

writeFileSync(sqlPath, lines.join("\n"));
console.log(`Wrote ${lines.length} statements to ${sqlPath}`);

execSync(`npx wrangler d1 execute ${DB} --remote --file=${sqlPath}`, { stdio: "inherit", cwd: root });

try {
  unlinkSync(sqlPath);
} catch {
  /* ignore */
}

console.log("address-warm: done");
