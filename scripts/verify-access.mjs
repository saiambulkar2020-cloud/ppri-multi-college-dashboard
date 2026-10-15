// Local smoke test: never sends credentials beyond the loopback website and never changes college data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL(process.argv[2] ?? "http://localhost:3001");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "This test only supports a local website.");
const credentials = process.env.SMOKE_ADMIN_ID ? "" : await readFile(new URL("../.env.admin-credentials.local", import.meta.url), "utf8");
const id = process.env.SMOKE_ADMIN_ID ?? credentials.match(/^ADMIN_ID=(.+)$/m)?.[1]?.trim();
const password = process.env.SMOKE_ADMIN_PASSWORD ?? credentials.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
assert.ok(id && password, "Run npm run auth:setup first.");
let cookie = "";
let passed = 0;
async function request(path, { method = "GET", body, origin = base.origin, withCookie = true } = {}) {
  if (path === "/api/reports/pdf" && body) body = { collegeId: "demo", ...body };
  return fetch(new URL(path, base), { method, redirect: "manual", signal: AbortSignal.timeout(60000), headers: {
    ...(method === "POST" ? { Origin: origin, "Content-Type": "application/json" } : {}),
    ...(cookie && withCookie ? { Cookie: cookie } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function check(label, condition) { assert.ok(condition, label); passed++; console.log(`PASS ${label}`); }
function receiveCookie(response) {
  const session = response.headers.getSetCookie().find((item) => item.startsWith("ppri_admin_access=") || item.startsWith("__Host-ppri_admin_access="));
  assert.ok(session, "Session cookie returned");
  cookie = session.split(";")[0];
  return session;
}

const collegePath = "/dashboard/colleges/demo";
const entry = await request("/dashboard");
check("Default dashboard redirects into its college", entry.status === 307 || (await entry.text()).includes(collegePath));
const demoPage = await request(collegePath);
check("Demo dashboard remains available", demoPage.status === 200 && (await demoPage.text()).includes("Demo Mode"));
const admin = await request("/dashboard/admin");
check("Direct admin page requires login", (admin.status === 307 && admin.headers.get("Location")?.includes("/login")) || (await admin.text()).includes("NEXT_REDIRECT;replace;/login"));
for (const path of ["/api/admin/validate", "/api/admin/import", "/api/admin/settings", "/api/admin/activate", "/api/reports/pdf"]) {
  const denied = await request(path, { method: "POST", body: { type: "college" } });
  check(`Anonymous ${path} denied (status ${denied.status})`, denied.status === 401);
}
check("Cross-origin login denied", (await request("/api/auth/login", { method: "POST", origin: "https://foreign.invalid", body: { id, password } })).status === 403);
check("Wrong password denied", (await request("/api/auth/login", { method: "POST", body: { id, password: "not-the-password" } })).status === 401);
const login = await request("/api/auth/login", { method: "POST", body: { id, password, next: "/dashboard/admin" } });
assert.equal(login.status, 200, `Login failed (${login.status}); check local access setup.`);
check("Login preserves protected destination", (await login.json()).next === "/dashboard/admin");
const setCookie = receiveCookie(login);
check("Session cookie is HttpOnly, SameSite and time-limited", /HttpOnly/i.test(setCookie) && /SameSite=lax/i.test(setCookie) && /Max-Age=1800/i.test(setCookie));
const session = await (await request("/api/auth/session")).json();
check("Verified administrator access is active", session.protectedAccess === true && session.user?.role === "admin");
const allowedPage = await request(`${collegePath}/admin`);
check("Authenticated admin page opens", allowedPage.status === 200 && (await allowedPage.text()).includes("Manage Sample college"));
const students = await request(`${collegePath}/students`);
check("Student links retain the college context", students.status === 200 && (await students.text()).includes(`${collegePath}/students/`));
for (const scope of [{ type: "college" }, { type: "branch", branch: "IT" }]) {
  const response = await request("/api/reports/pdf", { method: "POST", body: scope });
  const bytes = Buffer.from(await response.arrayBuffer());
  check(`${scope.branch ?? "College"} report is a valid PDF`, response.status === 200 && bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length > 10000);
  check(`${scope.branch ?? "College"} report is private and downloadable`, response.headers.get("Cache-Control") === "no-store" && response.headers.get("Content-Disposition")?.startsWith("attachment;"));
}
check("Missing branch rejected", (await request("/api/reports/pdf", { method: "POST", body: { type: "branch" } })).status === 400);
check("Unknown branch rejected", (await request("/api/reports/pdf", { method: "POST", body: { type: "branch", branch: "NOT-A-BRANCH" } })).status === 404);
check("Client-supplied dataset rejected", (await request("/api/reports/pdf", { method: "POST", body: { type: "college", students: [] } })).status === 400);
check("Authenticated cross-origin PDF denied", (await request("/api/reports/pdf", { method: "POST", origin: "https://foreign.invalid", body: { type: "college" } })).status === 403);
check("Authenticated cross-origin admin write denied", (await request("/api/admin/settings", { method: "POST", origin: "https://foreign.invalid", body: {} })).status === 403);
const validCookie = cookie;
cookie = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
check("Tampered session denied", (await request("/api/reports/pdf", { method: "POST", body: { type: "college" } })).status === 401);
cookie = validCookie;
const signout = await request("/api/auth/signout", { method: "POST" });
check("Sign-out clears the browser session", signout.status === 303 && /Max-Age=0/i.test(receiveCookie(signout)));
check("PDF access denied after sign-out", (await request("/api/reports/pdf", { method: "POST", body: { type: "college" } })).status === 401);
check("Demo viewing still works after sign-out", (await request(collegePath)).status === 200);
console.log(`${passed} local access checks passed. No credentials or PDF files were printed or saved.`);
