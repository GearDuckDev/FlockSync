import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { migrateDatabase } from "../dist/db/migrate.js";
import { normalizeSyncRealms } from "../dist/services/realmIdentity.js";

const LABEL = "Legacy Realm Label";
const SEP = "\u001f";

const seed = (db, characters) => {
  db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run("officer", "o@example.com", "officer", "hash", "ADMIN", 1);
  const insert = db.prepare(`INSERT INTO characters
    (guid, name, realm, class_id, level, primary_role, off_spec_enabled,
     role_updated_at, gear_json, gear_updated_at, last_seen_at, updated_by_officer_id)
    VALUES (?, ?, ?, 1, 60, 'DPS', 0, 1, '[]', 1, 1, 'officer')`);
  for (const [guid, realm] of characters) insert.run(guid, guid.slice(-4), realm);
  db.prepare("INSERT INTO guild_identity VALUES ('server', 'Guild', ?, 1)").run(LABEL);
  db.prepare(`INSERT INTO shared_kill_targets VALUES (?, ?, 'Enemy', ?, 'note', 'author', 'a', 'a', 10, 20, 0)`)
    .run(`${LABEL}${SEP}Guild`, `${LABEL.toLowerCase()}${SEP}enemy`, LABEL);
  const observation = {
    id: "S:Player-6930-00EE", kind: "SIGHTING", name: "Enemy", realm: LABEL,
    targetGuid: "Player-6930-00EE", targetCreatedAt: 10, timestamp: 30, zone: "Zone",
    reporterGuid: "Player-6930-00AA", reporter: "Reporter"
  };
  db.prepare("INSERT INTO kill_observations VALUES (?, ?, ?, 'SIGHTING', 30, ?)")
    .run(`${LABEL}${SEP}Guild`, `S:${LABEL.toLowerCase()}${SEP}enemy`, `${LABEL.toLowerCase()}${SEP}enemy`,
      JSON.stringify(observation));
};

const fresh = () => {
  const db = new Database(":memory:");
  migrateDatabase(db);
  return db;
};

test("realm migration rewrites labels to GUID server ids and is idempotent", () => {
  const db = fresh();
  try {
    seed(db, [["Player-6930-00AA", LABEL], ["Player-6930-00BB", ""], ["Player-6932-00CC", LABEL],
      ["Player-6932-00DD", "Other Label"], ["Player-6932-00FF", "Other Label"]]);
    // Labels the collector wrongly copied onto another server would be ambiguous; drop one to stay unanimous.
    db.prepare("UPDATE characters SET realm = 'Third' WHERE guid = 'Player-6932-00CC'").run();
    migrateDatabase(db);
    migrateDatabase(db);
    const realms = Object.fromEntries(db.prepare("SELECT guid, realm FROM characters").all().map((r) => [r.guid, r.realm]));
    assert.deepEqual(realms, {
      "Player-6930-00AA": "6930", "Player-6930-00BB": "6930", "Player-6932-00CC": "6932",
      "Player-6932-00DD": "6932", "Player-6932-00FF": "6932"
    });
    assert.equal(db.prepare("SELECT realm FROM guild_identity").get().realm, "6930");
    assert.deepEqual(db.prepare("SELECT guild_key, target_key, realm FROM shared_kill_targets").all(),
      [{ guild_key: `6930${SEP}Guild`, target_key: `6930${SEP}enemy`, realm: "6930" }]);
    const row = db.prepare("SELECT guild_key, id, target_key, payload FROM kill_observations").get();
    assert.equal(row.guild_key, `6930${SEP}Guild`);
    assert.equal(row.id, `S:6930${SEP}enemy`);
    assert.equal(row.target_key, `6930${SEP}enemy`);
    assert.equal(JSON.parse(row.payload).realm, "6930");
  } finally {
    db.close();
  }
});

test("ambiguous guild realm refuses to migrate until GUILD_SERVER_ID resolves it", () => {
  const db = fresh();
  try {
    seed(db, [["Player-6930-00AA", LABEL], ["Player-6932-00CC", LABEL]]);
    assert.throws(() => migrateDatabase(db), /GUILD_SERVER_ID/u);
    assert.equal(db.prepare("SELECT realm FROM guild_identity").get().realm, LABEL, "Failed migration rolls back");
    assert.equal(db.prepare("SELECT count(*) AS n FROM characters WHERE realm = ?").get(LABEL).n, 2);
    migrateDatabase(db, "6932");
    assert.equal(db.prepare("SELECT realm FROM guild_identity").get().realm, "6932");
    assert.equal(db.prepare("SELECT realm FROM shared_kill_targets").get().realm, "6932");
  } finally {
    db.close();
  }
});

test("sync normalization derives realms from GUIDs for legacy uploads", () => {
  const character = (guid, realm) => ({ guid, realm });
  const result = normalizeSyncRealms({
    officerCharacter: character("Player-6930-00AA", LABEL),
    characters: [character("Player-6932-00BB", LABEL), character("Player-6930-00CC", ""), character("Custom", "Keep")],
    collectorGuild: { name: "Guild", realm: LABEL },
    sharedKillList: [{ name: "Enemy", realm: LABEL }, { name: "Foreign", realm: "Elsewhere" }],
    sharedKillObservations: [{ name: "Enemy", realm: LABEL }]
  });
  assert.equal(result.officerCharacter.realm, "6930");
  assert.deepEqual(result.characters.map((c) => c.realm), ["6932", "6930", "Keep"]);
  assert.deepEqual(result.collectorGuild, { name: "Guild", realm: "6930" });
  assert.deepEqual(result.sharedKillList.map((e) => e.realm), ["6930", "Elsewhere"]);
  assert.equal(result.sharedKillObservations[0].realm, "6930");
  const mismatched = normalizeSyncRealms({
    officerCharacter: character("Player-6930-00AA", LABEL), characters: [],
    collectorGuild: { name: "Guild", realm: "Another" }
  });
  assert.equal(mismatched.collectorGuild.realm, "Another", "Mismatched guild realms stay rejectable");
});
