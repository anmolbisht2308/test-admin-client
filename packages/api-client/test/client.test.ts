import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, createApiClient, fieldErrors } from "../src";

const session = (token: string) => ({
  accessToken: token,
  expiresInSec: 900,
  user: {
    id: "64b000000000000000000001",
    role: "student",
    name: null,
    phone: "+919876543210",
    email: null,
    language: "en",
    targetExamSlugs: [],
    onboarded: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
});

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function setup(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; auth: string | undefined }[] = [];
  const fetchMock = vi.fn((url: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url: String(url), auth: headers.authorization });
    return Promise.resolve(handler(String(url), init));
  });
  const onSession = vi.fn();
  const client = createApiClient({
    refreshPath: "/api/auth/refresh",
    logoutPath: "/api/auth/logout",
    onSession,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client, calls, onSession };
}

describe("createApiClient", () => {
  it("refreshes once on 401 and retries with the new token", async () => {
    let refreshes = 0;
    const { client, calls, onSession } = setup((url, init) => {
      if (url === "/api/auth/refresh") {
        refreshes++;
        return json(200, session(`token-${refreshes}`));
      }
      const auth = (init.headers as Record<string, string>).authorization;
      return auth === "Bearer token-1"
        ? json(200, { ok: true })
        : json(401, { error: "Sign in required" });
    });

    const result = await client.request("/api/me", { schema: z.object({ ok: z.boolean() }) });
    expect(result).toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual(["/api/me", "/api/auth/refresh", "/api/me"]);
    expect(onSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "token-1" }));
  });

  it("shares one refresh between concurrent requests", async () => {
    let refreshes = 0;
    const { client } = setup((url, init) => {
      if (url === "/api/auth/refresh") {
        refreshes++;
        return json(200, session("fresh"));
      }
      const auth = (init.headers as Record<string, string>).authorization;
      return auth === "Bearer fresh" ? json(200, {}) : json(401, { error: "x" });
    });
    await Promise.all([
      client.request("/api/a"),
      client.request("/api/b"),
      client.request("/api/c"),
    ]);
    expect(refreshes).toBe(1);
  });

  it("reports signed out when refresh returns 401, and surfaces api errors", async () => {
    const { client, onSession } = setup((url) =>
      url === "/api/auth/refresh"
        ? json(401, { error: "Not signed in" })
        : json(401, { error: "Sign in required" }),
    );
    await expect(client.refresh()).resolves.toBeNull();
    expect(onSession).toHaveBeenLastCalledWith(null);
    await expect(client.request("/api/me")).rejects.toMatchObject({
      status: 401,
      message: "Sign in required",
    });
  });

  it("parses { error, details } into ApiError", async () => {
    const { client } = setup(() =>
      json(409, { error: "Already exists", details: { fields: ["slug"] } }),
    );
    const error = await client
      .request("/api/admin/exams", { method: "POST", body: {} })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Already exists",
      details: { fields: ["slug"] },
    });
  });
});

describe("fieldErrors", () => {
  it("maps zod issues to dotted paths, first message wins", () => {
    expect(
      fieldErrors([
        { path: ["sections", 0, "name"], message: "required" },
        { path: ["sections", 0, "name"], message: "second" },
        { path: ["totalTimeSec"], message: "too short" },
      ]),
    ).toEqual({ "sections.0.name": "required", totalTimeSec: "too short" });
    expect(fieldErrors("nope")).toEqual({});
  });
});

describe("raw bodies", () => {
  it("sends files as-is with their content type", async () => {
    let seen: RequestInit | undefined;
    const { client } = setup((_url, init) => {
      seen = init;
      return json(200, { ok: true });
    });
    const file = new Blob(["a,b\n1,2"], { type: "text/csv" });
    await client.request("/api/admin/questions/import", {
      method: "POST",
      rawBody: file,
      contentType: "text/csv",
    });
    expect((seen?.headers as Record<string, string>)["content-type"]).toBe("text/csv");
    expect(seen?.body).toBe(file);
  });
});
