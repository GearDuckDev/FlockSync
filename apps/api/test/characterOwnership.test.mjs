import assert from "node:assert/strict";
import { test } from "node:test";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("legacy character-to-account assignment endpoints are unavailable", async (t) => {
  const { call, admin } = await startOwnershipServer(t);
  for (const [method, path] of [
    ["GET", "/character-ownership", undefined],
    ["GET", "/character-ownership/mine", undefined],
    ["PUT", "/character-ownership/character"],
    ["PUT", "/character-ownership/group"]
  ]) {
    const body = method === "PUT" ? {} : undefined;
    assert.equal((await call(method, path, admin.token, body)).status, 404);
  }
});
