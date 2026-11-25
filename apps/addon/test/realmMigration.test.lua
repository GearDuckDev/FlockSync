local ns, playerGuid = {}, nil
function UnitGUID() return playerGuid end
for _, name in ipairs({ "Ruleset", "RealmMigration" }) do
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
local SEP = "\031"
local function target(name, realm, updatedAt, note)
    return { name = name, realm = realm, note = note, createdAt = 10, updatedAt = updatedAt, deleted = false }
end
local function sighting(name, realm, timestamp)
    return { id = "S:Player-6930-00EE", kind = "SIGHTING", name = name, realm = realm, timestamp = timestamp }
end
FlockSyncDB = {
    config = { realmIdentity = "Manual Label" },
    officerCharacter = "Officer One (CAMWOW US2 Realm 4 PvP)",
    accountCharacters = { ["Player-6930-0001"] = { guid = "Player-6930-0001", realm = "CAMWOW US2 Realm 4 PvP" } },
    characters = {
        ["Player-6930-0002"] = { guid = "Player-6930-0002", realm = "", lastSeenAt = 5 },
        ["Player-6932-0003"] = { guid = "Player-6932-0003", realm = "CAMWOW US2 Realm 6 PvP" },
        ["Player-6922-0004"] = { guid = "Player-6922-0004", realm = "Shared Label" },
        ["Player-6924-0005"] = { guid = "Player-6924-0005", realm = "Shared Label" },
        Legacy = { guid = "Legacy", realm = "Kept Label" },
    },
    killListGuilds = {
        ["CAMWOW US2 Realm 4 PvP" .. SEP .. "Guild"] = {
            ["camwow us2 realm 4 pvp" .. SEP .. "enemy"] = target("Enemy", "CAMWOW US2 Realm 4 PvP", 30, "old label newer"),
            ["camwow us2 realm 4 pvp" .. SEP .. "other"] = target("Other", "CAMWOW US2 Realm 4 PvP", 20, "only label"),
        },
        ["6930" .. SEP .. "Guild"] = { ["6930" .. SEP .. "enemy"] = target("Enemy", "6930", 25, "server older") },
        ["Shared Label" .. SEP .. "Guild"] = { ["shared label" .. SEP .. "x"] = target("X", "Shared Label", 1) },
    },
    killListObservationsGuilds = {
        ["CAMWOW US2 Realm 4 PvP" .. SEP .. "Guild"] = {
            ["S:camwow us2 realm 4 pvp" .. SEP .. "enemy"] = sighting("Enemy", "CAMWOW US2 Realm 4 PvP", 50),
            battle = { id = "battle", kind = "KILL", name = "Enemy", realm = "CAMWOW US2 Realm 4 PvP", timestamp = 40 },
        },
        ["6930" .. SEP .. "Guild"] = { ["S:6930" .. SEP .. "enemy"] = sighting("Enemy", "6930", 60) },
    },
    killListCharacters = { ["Player-6930-0001"] = {
        entries = { ["manual label" .. SEP .. "personal"] = target("Personal", "Manual Label", 5) },
        observations = { ["S:manual label" .. SEP .. "personal"] = sighting("Personal", "Manual Label", 9) },
        localGuildObservations = { ["Manual Label" .. SEP .. "Guild"] = {
            ["S:manual label" .. SEP .. "personal"] = sighting("Personal", "Manual Label", 9),
        } },
    } },
}
ns.MigrateRealmIdentity()
assert(FlockSyncDB.realmIdentityVersion == nil, "A manual identity waits for the player GUID")
assert(FlockSyncDB.characters["Player-6930-0002"].realm == "")
playerGuid = "Player-6930-0001"
ns.MigrateRealmIdentity()
local db = FlockSyncDB
assert(db.realmIdentityVersion == 1 and db.config.realmIdentity == nil)
assert(db.characters["Player-6930-0002"].realm == "6930" and db.characters["Player-6930-0002"].lastSeenAt == 5)
assert(db.characters["Player-6932-0003"].realm == "6932" and db.accountCharacters["Player-6930-0001"].realm == "6930")
assert(db.characters.Legacy.realm == "Kept Label", "Records without a server id are left alone")
assert(db.officerCharacter == "Officer One (6930)")
assert(ns.NormalizeRealm("CAMWOW US2 Realm 4 PvP") == "6930" and ns.NormalizeRealm("Manual Label") == "6930")
assert(ns.NormalizeRealm("Shared Label") == nil, "Labels used by two servers are never guessed")
assert(ns.IsPlayerRealm("CAMWOW US2 Realm 4 PvP") and ns.IsPlayerRealm("6930") and not ns.IsPlayerRealm("6932"))
local shared = db.killListGuilds["6930" .. SEP .. "Guild"]
assert(db.killListGuilds["CAMWOW US2 Realm 4 PvP" .. SEP .. "Guild"] == nil)
assert(shared["6930" .. SEP .. "enemy"].note == "old label newer", "Newest target wins on key clash")
assert(shared["6930" .. SEP .. "other"].realm == "6930")
assert(db.killListGuilds["Shared Label" .. SEP .. "Guild"], "Ambiguous guild keys are kept unchanged")
local observations = db.killListObservationsGuilds["6930" .. SEP .. "Guild"]
assert(observations["S:6930" .. SEP .. "enemy"].timestamp == 60, "Newest sighting wins on key clash")
assert(observations.battle.realm == "6930", "Battle ids are preserved")
local state = db.killListCharacters["Player-6930-0001"]
assert(state.entries["6930" .. SEP .. "personal"].realm == "6930")
assert(state.observations["S:6930" .. SEP .. "personal"])
assert(state.localGuildObservations["6930" .. SEP .. "Guild"]["S:6930" .. SEP .. "personal"])
db.characters["Player-6932-0003"].realm = "Changed"
ns.MigrateRealmIdentity()
assert(db.characters["Player-6932-0003"].realm == "Changed", "Migration runs once")
print("SavedVariables realm-name to server-id migration, clashes, ambiguity and idempotency: passed")
