import { describe, expect, it, vi } from "vitest";
import { accessErrorResponse, readLimitedJson } from "../lib/access-http";

function jsonRequest(body: string, contentLength?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (contentLength !== undefined) headers.set("Content-Length", contentLength);
  return new Request("http://localhost:3001/api/auth/login", { method: "POST", headers, body });
}

describe("Bounded request JSON", () => {
  it("reads a valid body without trusting Content-Length", async () => {
    await expect(readLimitedJson(jsonRequest('{"id":"admin"}'))).resolves.toEqual({ id: "admin" });
    await expect(readLimitedJson(jsonRequest('{"id":"admin"}', "1"))).resolves.toEqual({ id: "admin" });
  });

  it.each([undefined, "1", "invalid"])("enforces actual bytes with Content-Length %s", async (declared) => {
    await expect(readLimitedJson(jsonRequest('{"id":"administrator"}', declared), 10)).rejects.toThrow("BODY_TOO_LARGE");
  });

  it("rejects a declared oversized request immediately", async () => {
    const request = jsonRequest("{}", "9000");
    await expect(readLimitedJson(request)).rejects.toThrow("BODY_TOO_LARGE");
    expect(request.bodyUsed).toBe(true);
  });

  it("counts UTF-8 bytes and accepts the exact byte limit", async () => {
    const payload = JSON.stringify({ label: "विद्यार्थी" });
    const byteLength = new TextEncoder().encode(payload).byteLength;
    expect(byteLength).toBeGreaterThan(payload.length);
    await expect(readLimitedJson(jsonRequest(payload), byteLength)).resolves.toEqual({ label: "विद्यार्थी" });
    await expect(readLimitedJson(jsonRequest(payload), byteLength - 1)).rejects.toThrow("BODY_TOO_LARGE");
  });

  it("cancels a chunked stream as soon as cumulative bytes exceed its limit", async () => {
    const cancel = vi.fn();
    const chunks = [new TextEncoder().encode('{"id":"'), new TextEncoder().encode("administrator"), new TextEncoder().encode('"}')];
    let delivered = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (delivered < chunks.length) controller.enqueue(chunks[delivered++]);
        else controller.close();
      },
      cancel,
    });
    const request = new Request("http://localhost:3001/api/auth/login", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readLimitedJson(request, 10)).rejects.toThrow("BODY_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
    expect(request.body?.locked).toBe(false);
  });

  it("decodes multibyte characters split across stream chunks", async () => {
    const bytes = new TextEncoder().encode('{"label":"ह"}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const request = new Request("http://localhost:3001/api/auth/login", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readLimitedJson(request, bytes.length)).resolves.toEqual({ label: "ह" });
  });

  it.each(["", "   ", '{"id":', "not JSON"])("rejects invalid or empty JSON (%j)", async (payload) => {
    await expect(readLimitedJson(jsonRequest(payload))).rejects.toThrow("INVALID_BODY");
  });

  it("rejects an absent body", async () => {
    const request = new Request("http://localhost:3001/api/auth/login", { method: "POST" });
    await expect(readLimitedJson(request)).rejects.toThrow("INVALID_BODY");
  });

  it("rejects malformed UTF-8 rather than replacing credential bytes", async () => {
    const bytes = new Uint8Array([123, 34, 105, 100, 34, 58, 34, 255, 34, 125]);
    const request = new Request("http://localhost:3001/api/auth/login", { method: "POST", body: bytes });
    await expect(readLimitedJson(request)).rejects.toThrow("INVALID_BODY");
  });

  it.each([["INVALID_BODY", 400], ["BODY_TOO_LARGE", 413]] as const)("returns a safe %s response", async (code, status) => {
    const response = accessErrorResponse(new Error(code));
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain(code);
  });
});
