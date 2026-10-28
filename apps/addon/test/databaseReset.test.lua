local ns = {}
local registered = 0
function GetServerTime() return 1000 end
ns.CacheAddonReleases = function() end
ns.RegisterAccountCharacter = function() registered = registered + 1 end

assert(loadfile("apps/addon/FlockSync/Snapshot.lua"))("FlockSync", ns)
FlockSyncDB = {
    databaseResetAt = 100,
    profiles = { old = {} },
    accountCharacters = { old = {} },
    characters = { old = {} },
    staleCharacters = { old = true },
    guildLedger = { loot = { {} }, attendance = { {} } },
    guildSnapshot = { serverTimestamp = 500 },
    myProfile = {},
    exportedAt = 500,
    config = { hasCompletedOnboarding = true },
}

assert(not ns.ApplyDatabaseReset(100), "Equal reset must not clear current data")
assert(FlockSyncDB.characters.old)
assert(not ns.ApplyDatabaseReset(2000), "Far-future reset must be rejected")
assert(ns.ApplyDatabaseReset(900), "New reset must be applied")
assert(FlockSyncDB.databaseResetAt == 900)
for _, key in ipairs({ "profiles", "accountCharacters", "characters", "staleCharacters" }) do
    assert(next(FlockSyncDB[key]) == nil, key .. " must be cleared")
end
assert(#FlockSyncDB.guildLedger.loot == 0)
assert(#FlockSyncDB.guildLedger.attendance == 0)
assert(FlockSyncDB.guildSnapshot == nil)
assert(FlockSyncDB.myProfile == nil)
assert(FlockSyncDB.exportedAt == 0)
assert(FlockSyncDB.config.hasCompletedOnboarding, "User setup must be retained")
assert(registered == 1, "Current account character must be registered again")

FlockSyncDB.characters.fresh = {}
assert(not ns.ApplyDatabaseReset(900), "Repeated marker must not erase fresh data")
assert(FlockSyncDB.characters.fresh)
assert(ns.ApplyBroadcastSnapshot({
    serverTimestamp = 1000, databaseResetAt = 950
}, "Guild"))
assert(FlockSyncDB.databaseResetAt == 950, "Broadcast must apply the reset")
assert(next(FlockSyncDB.characters) == nil)
assert(FlockSyncDB.guildSnapshot.guild == "Guild")
print("Database reset regressions passed")
