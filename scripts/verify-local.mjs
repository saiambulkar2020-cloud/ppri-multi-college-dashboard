// Run after a demo-mode npm run build. Uses ephemeral credentials; the checks refuse live mode.
import { randomBytes, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
const id = "smoke-admin";
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = `scrypt-v1$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const port = "3107";
const env = { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", ACCESS_ADMIN_ID: id, ACCESS_ADMIN_PASSWORD_HASH: hash, ACCESS_SESSION_SECRET: randomBytes(32).toString("hex") };
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", (chunk) => { log += chunk.toString(); });
server.stderr.on("data", (chunk) => { log += chunk.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Local test server exited: ${log}`);
    if (log.includes("Ready in")) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/api/auth/session`, { signal: AbortSignal.timeout(2000) })).ok; } catch { /* Server is starting. */ }
    }
    if (ready) break;
    await setTimeout(500);
  }
  if (!ready) throw new Error(`Local server did not start: ${log}`);
  const test = spawn(process.execPath, ["scripts/verify-access.mjs", `http://localhost:${port}`], { env: { ...env, SMOKE_ADMIN_ID: id, SMOKE_ADMIN_PASSWORD: password }, windowsHide: true, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { test.on("exit", resolve); test.on("error", reject); });
  if (code !== 0) throw new Error(`Local access checks failed (${code}).`);
  if (process.argv.includes("--keep-server")) {
    console.log(`Preview ready at http://localhost:${port}/dashboard (temporary credentials remain private). Stop this command when finished.`);
    await new Promise((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} finally {
  server.kill();
}
