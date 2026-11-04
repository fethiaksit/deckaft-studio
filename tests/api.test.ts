import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { ApiClient, ApiError } from "../src/core/api/client";
test("future API preserves Headers credentials and handles JSON, 204 and server failure", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/empty") {
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/fail") {
      res.writeHead(503).end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({ authorization: req.headers.authorization ?? null }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    const client = new ApiClient(`http://127.0.0.1:${addr.port}`);
    assert.deepEqual(
      await client.request("/projects", {
        headers: new Headers({ Authorization: "Bearer test-only" }),
      }),
      { authorization: "Bearer test-only" },
    );
    assert.equal(await client.request("/empty"), undefined);
    await assert.rejects(
      client.request("/fail"),
      (e) => e instanceof ApiError && e.status === 503,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});
test("unconfigured backend and unsafe relative URLs fail before fetch", async () => {
  await assert.rejects(
    new ApiClient("").request("/projects"),
    /yapılandırılmadı/,
  );
  await assert.rejects(
    new ApiClient("http://127.0.0.1").request("//other.example"),
    /geçersiz/,
  );
});
