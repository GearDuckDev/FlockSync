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
playerGuid = "Player-6930-0001"
ns.MigrateRealmIdentity()
local db = FlockSyncDB
assert(db.realmIdentityVersion == 2 and db.config.realmIdentity == nil)
assert(db.characters["Player-6930-0002"].realm == "6930" and db.characters["Player-6930-0002"].lastSeenAt == 5)
assert(db.characters["Player-6932-0003"].realm == "6932" and db.accountCharacters["Player-6930-0001"].realm == "6930")
assert(db.characters.Legacy.realm == "Kept Label", "Records without a server id are left alone")
assert(db.officerCharacter == "Officer One (6930)")
assert(ns.NormalizeRealm("CAMWOW US2 Realm 4 PvP") == "6930")
assert(ns.NormalizeRealm("Manual Label") == nil, "A manual identity is not pinned to the player's own server")
assert(ns.NormalizeRealm("Shared Label") == nil, "Labels used by two servers are never guessed")
ns.CurrentGuildName = function() return "Guild" end
assert(ns.IsOwnGuild({ name = "Guild", realm = "6932" }) and not ns.IsOwnGuild({ name = "Other", realm = "6930" }),
    "Guild scope matches by name across connected-realm servers")
for key in pairs(db.killListGuilds) do assert(key == "Guild", "Guild stores are keyed by name: " .. key) end
local shared = db.killListGuilds.Guild
assert(shared["6930" .. SEP .. "enemy"].note == "old label newer", "Newest target wins on key clash")
assert(shared["6930" .. SEP .. "other"].realm == "6930")
assert(shared["shared label" .. SEP .. "x"].realm == "Shared Label", "Ambiguous labels stay labels")
local observations = db.killListObservationsGuilds.Guild
assert(observations["S:6930" .. SEP .. "enemy"].timestamp == 60, "Newest sighting wins on key clash")
assert(observations.battle.realm == "6930", "Battle ids are preserved")
local state = db.killListCharacters["Player-6930-0001"]
assert(state.entries["manual label" .. SEP .. "personal"].realm == "Manual Label")
assert(state.observations["S:manual label" .. SEP .. "personal"])
assert(state.localGuildObservations.Guild["S:manual label" .. SEP .. "personal"])
db.characters["Player-6932-0003"].realm = "Changed"
ns.MigrateRealmIdentity()
assert(db.characters["Player-6932-0003"].realm == "Changed", "Migration runs once")
FlockSyncDB = { realmIdentityVersion = 1, killListGuilds = { ["6930" .. SEP .. "Guild"] = {
    ["6930" .. SEP .. "enemy"] = target("Enemy", "6930", 25) } } }
ns.MigrateRealmIdentity()
assert(FlockSyncDB.killListGuilds.Guild["6930" .. SEP .. "enemy"], "Version 1 server-keyed guild stores are rekeyed")
print("SavedVariables realm migration, name-keyed guilds, clashes, ambiguity and idempotency: passed")