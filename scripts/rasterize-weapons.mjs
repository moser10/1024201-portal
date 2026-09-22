#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = join(process.cwd(), "icons", "weapon");
const SIZE = 256;
const KINDS = ["pistol", "ak", "rpg", "knife", "shotgun"];
const ALIAS = {
  pistol: ["pistol", "gun", "handgun", "手枪"],
  ak: ["ak", "ak47", "rifle", "突击", "步枪"],
  rpg: ["rpg", "rocket", "火箭"],
  knife: ["knife", "blade", "刀"],
  shotgun: ["shotgun", "霰弹", "散弹"],
};

function stemOf(name) {
  return name.replace(/\.[^.]+$/, "").toLowerCase();
}

function kindFor(file) {
  const stem = stemOf(file);
  for (const kind of KINDS) {
    if (stem === kind || ALIAS[kind].some((alias) => stem.includes(alias))) return kind;
  }
  return null;
}

async function rasterize(svgText) {
  try {
    const sharp = (await import("sharp")).default;
    return sharp(Buffer.from(svgText)).resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
  } catch {
    const { Resvg } = await import("@resvg/resvg-js");
    const img = new Resvg(svgText, {
      fitTo: { mode: "width", value: SIZE },
      background: "rgba(0,0,0,0)",
    }).render();
    return img.asPng();
  }
}

const files = (await readdir(ROOT).catch(() => [])).filter((name) => !name.startsWith("."));
const svgs = files.filter((name) => extname(name).toLowerCase() === ".svg");
if (!svgs.length) {
  console.warn("icons/weapon has no SVG files to convert");
  process.exit(0);
}

await mkdir(ROOT, { recursive: true });
const used = new Set();
for (const file of svgs) {
  const kind = kindFor(file);
  if (!kind) {
    console.warn(`skip unmatched svg: ${file}`);
    continue;
  }
  const svgText = await readFile(join(ROOT, file), "utf8");
  const png = await rasterize(svgText);
  const dest = join(ROOT, `${kind}.png`);
  await writeFile(dest, png);
  used.add(kind);
  console.log(`converted ${file} -> ${kind}.png (${png.length} bytes)`);
}

const missing = KINDS.filter((kind) => !used.has(kind));
if (missing.length) console.warn(`no svg for: ${missing.join(", ")}`);
