// Screenshot helper: logs in, then captures pages (WebGL via SwiftShader).
// Usage: node scripts/shot.mjs <outDir> <path> [path...]   e.g. node scripts/shot.mjs /tmp/shots / /config
// Env: BASE (default http://localhost:3000), WIDTH (1440), HEIGHT (900), FULL=1 for full page, WAIT ms (2500)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || paths.length === 0) {
  console.error("usage: node scripts/shot.mjs <outDir> <path> [path...]");
  process.exit(1);
}
const BASE = process.env.BASE || "http://localhost:3000";
const env = fs.readFileSync(".env", "utf8");
const password = /APP_PASSWORD="([^"]*)"/.exec(env)?.[1];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: { width: +(process.env.WIDTH || 1440), height: +(process.env.HEIGHT || 900) },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const res = await page.request.post(`${BASE}/api/auth/login`, { data: { username: "estates", password } });
if (!res.ok()) console.error("login failed", res.status());
for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }).catch((e) => errors.push(String(e)));
  await page.waitForTimeout(+(process.env.WAIT || 2500));
  const file = path.join(outDir, (p.replace(/[^a-z0-9]+/gi, "_") || "_root") + ".png");
  await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
  console.log("saved", file);
}
if (errors.length) console.log("CONSOLE ERRORS:\n" + errors.slice(0, 30).join("\n"));
await browser.close();
