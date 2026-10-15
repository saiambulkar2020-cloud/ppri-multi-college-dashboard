import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashAccessPassword } from "../lib/access-crypto";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const credentialPath = fileURLToPath(new URL("../.env.admin-credentials.local", import.meta.url));
const rotate = process.argv.includes("--rotate");
const id = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "admin";
if (!/^[A-Za-z0-9@._-]{3,100}$/.test(id)) throw new Error("Use a 3–100 character admin ID containing letters, numbers, @, dots, underscores or hyphens.");
const existing = await readFile(envPath, "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return ""; throw error; });
const keys = /^ACCESS_(ADMIN_ID|ADMIN_PASSWORD_HASH|SESSION_SECRET)=.*$/gm;
if (!rotate && (existing.match(keys) ?? []).some((line) => line.split("=").slice(1).join("=").trim())) {
  throw new Error("Admin access is already configured. To intentionally replace the credentials and invalidate existing admin sessions, run npm run auth:setup -- --rotate.");
}
const password = randomBytes(18).toString("base64url");
const passwordHash = await hashAccessPassword(password);
const secret = randomBytes(32).toString("hex");
// Next.js expands $VARIABLE references in .env files; escape the hash separators.
const envHash = passwordHash.replace(/\$/g, "\\$");
const content = `${existing.replace(keys, "").trimEnd()}\n\n# Server-only administrator access. Never commit this file.\nACCESS_ADMIN_ID=${id}\nACCESS_ADMIN_PASSWORD_HASH=${envHash}\nACCESS_SESSION_SECRET=${secret}\n`;
// These are local setup artifacts, not application source or public assets.
await writeFile(credentialPath, `# PRIVATE — do not commit, deploy publicly, or share this file.\n# Save the password in your password manager; this file is not used by the website.\n# In Supabase mode, use your Supabase administrator email/password instead.\nADMIN_ID=${id}\nADMIN_PASSWORD=${password}\n`, { encoding: "utf8", mode: 0o600, flag: rotate ? "w" : "wx" });
await writeFile(envPath, content, { encoding: "utf8", mode: 0o600 });
console.log(`Administrator access configured for ID: ${id}.`);
console.log("Your generated password is in .env.admin-credentials.local (gitignored). Keep it private.");
console.log("Restart the website if it is already running. Supabase mode continues to use Supabase accounts.");
