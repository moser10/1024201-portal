import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const android = join(root, "tools/ft/android");
const dist = join(root, "tools/ft/dist");
const gradle = "/opt/gradle-7.6.4/bin/gradle";

function gradleVersion() {
  const text = readFileSync(join(android, "app/build.gradle"), "utf8");
  const name = text.match(/versionName\s+"([^"]+)"/)?.[1];
  const code = Number(text.match(/versionCode\s+(\d+)/)?.[1] || 0);
  if (!name) throw new Error("versionName missing in tools/ft/android/app/build.gradle");
  return { version: name, versionCode: code };
}

function compile() {
  const bin = existsSync(gradle) ? gradle : "gradle";
  execSync(`${JSON.stringify(bin)} assembleDebug --no-daemon`, { cwd: android, stdio: "inherit" });
}

function published(meta) {
  const built = join(android, "app/build/outputs/apk/debug/app-debug.apk");
  if (!existsSync(built)) throw new Error("assembleDebug did not produce app-debug.apk");
  mkdirSync(dist, { recursive: true });
  for (const name of readdirSync(dist)) {
    if (/\.apk$/i.test(name)) unlinkSync(join(dist, name));
  }
  const stable = join(dist, "ft-tv-debug.apk");
  copyFileSync(built, stable);
  writeFileSync(
    join(dist, "ft-tv.json"),
    `${JSON.stringify(
      {
        version: meta.version,
        versionCode: meta.versionCode,
        file: "ft-tv-debug.apk",
        download: `ft-tv-${meta.version}.apk`,
        builtAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
  console.log("ft-tv APK", meta.version, "→ tools/ft/dist/ft-tv-debug.apk");
}

const meta = gradleVersion();
compile();
published(meta);
