import assert from "node:assert/strict";

// Auto-stale (30+ days idle, reported by the addon) vs manual culls.
export const checkStaleCharacters = async (origin, token, officer) => {
  const call = async (method, path, body) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    assert.ok(response.ok, `${method} ${path}: ${response.ok ? "" : await response.text()}`);
    return response.status === 204 ? undefined : response.json();
  };
  const now = Math.floor(Date.now() / 1000);
  const old = now - 31 * 24 * 60 * 60;
  const base = { ...officer, lastSeenAt: old };
  const idle = { ...base, guid: `${officer.guid}-idle`, name: "Idle" };
  const culled = { ...base, guid: `${officer.guid}-culled`, name: "Culled" };
  const recent = { ...base, guid: `${officer.guid}-recent`, name: "Recent", lastSeenAt: now - 60 };
  const sync = (characters) => call("POST", "/sync", {
    addonVersion: "test", officerCharacter: officer, characters, exportedAt: now
  });
  const activeGuids = async () => new Set((await call("GET", "/roster")).map((c) => c.guid));

  await sync([idle, culled, recent]);
  await call("PATCH", `/roster/${culled.guid}/status`, { isActive: false });

  // Stale reports: only genuinely old characters are auto-staled; manual culls untouched.
  const staled = await sync([
    { ...idle, isActive: false }, { ...culled, isActive: false }, { ...recent, isActive: false }
  ]);
  let active = await activeGuids();
  assert.ok(!active.has(idle.guid), "idle character auto-staled");
  assert.ok(active.has(recent.guid), "recent character is never auto-staled");
  assert.ok(staled.culledCharacterGuids.includes(culled.guid), "manual cull still reported");
  assert.ok(!staled.culledCharacterGuids.includes(idle.guid), "auto-stale is not a cull");

  // The idle character logs in again; the manually culled one also returns.
  await sync([{ ...idle, isActive: true, lastSeenAt: now }, { ...culled, isActive: false, lastSeenAt: now }]);
  active = await activeGuids();
  assert.ok(active.has(idle.guid), "returning character is revived");
  assert.ok(!active.has(culled.guid), "manual cull stays sticky");

  for (const character of [idle, culled, recent]) await call("DELETE", `/roster/${character.guid}`);
};
