local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local officer = net:client("Officer Two", "Player-1-P2", 1)
local member = net:client("Member One", "Player-1-P1", 5)
local chunk = assert(loadfile("apps/addon/FlockSync/KillListBridge.lua"))
setfenv(chunk, officer.env)("FlockSync", officer.ns)
local raw = {
    name = "Enemy Player", realm = "1", author = "Member One", authorGuid = "Player-1-P1",
    actorGuid = "Player-1-P1", note = "Server note", createdAt = 90, updatedAt = 95, deleted = false,
}
officer.env.FlockSyncHelperDB = {
    isAuthorizedOfficer = true, authorizedCollectorGuild = { name = "Guild", realm = "1" },
    sharedKillList = { raw },
}
officer.ns.EnforceSnapshotGuild = function() end
officer.ns.LoadSnapshot = function() end
member.ns.LoadSnapshot = function() end
officer:fire("PLAYER_LOGIN")
member:fire("PLAYER_LOGIN")
local key = "1\031enemy player"
assert(officer.ns.KillStore("shared")[key].note == "Server note")
net:drain()
assert(member.ns.KillStore("shared")[key].note == "Server note",
    "Login automatically imports and relays server result without a sync command/button")
raw.note, raw.updatedAt = "Web edited", math.floor(net.now) + 1
net.now = net.now + 1
officer.ns.LoadServerKillList()
officer.ns.RespondKillSync()
net:drain()
assert(member.ns.KillStore("shared")[key].note == "Web edited")
raw.note, raw.deleted, raw.updatedAt = "", true, math.floor(net.now) + 1
net.now = net.now + 1
officer.ns.LoadServerKillList()
officer.ns.RespondKillSync()
net:drain()
assert(member.ns.KillStore("shared")[key].deleted)
assert(next(member.ns.KillStore("personal")) == nil)
raw.note, raw.deleted, raw.updatedAt = "Offline old edit", false, math.floor(net.now) + 1
net.now = net.now + 1
officer.ns.LoadServerKillList()
assert(officer.ns.KillStore("shared")[key].deleted, "Newer edit of old creation cannot restore a removal")
raw.note, raw.deleted, raw.updatedAt = "Stale", false, 95
officer.ns.LoadServerKillList()
assert(officer.ns.KillStore("shared")[key].deleted, "Stale helper cannot restore tombstone")
officer.env.FlockSyncHelperDB.authorizedCollectorGuild.name = "Other"
raw.updatedAt = math.floor(net.now) + 1
officer.ns.LoadServerKillList()
assert(officer.ns.KillStore("shared")[key].deleted, "Cross-guild helper rejected")
for _, client in ipairs({ officer, member }) do
    client.env.GetRealmName = function() return "" end
    client.env.GetNormalizedRealmName = function() return "" end
end
-- Blank-realm clients identify by GUID server id; a pre-1.2 helper label still
-- resolves through the migrated legacy label map until the next Desktop sync.
officer.env.FlockSyncDB.legacyRealmLabels = { ["Legacy Realm"] = "1" }
officer.env.FlockSyncHelperDB.authorizedCollectorGuild = { name = "Guild", realm = "Legacy Realm" }
raw.name, raw.realm, raw.note, raw.deleted = "Forever Enemy", "1", "Server note", false
raw.createdAt, raw.updatedAt = math.floor(net.now), math.floor(net.now)
officer.ns.LoadServerKillList()
officer.ns.RespondKillSync(); net:drain()
local foreverKey = "1\031forever enemy"
assert(officer.ns.KillStore("shared")[foreverKey].note == "Server note")
assert(member.ns.KillStore("shared")[foreverKey].note == "Server note")
member.ns.SetKillSetting("enabled", true)
assert(member.ns.SaveKillTarget("New Forever Enemy", "1", "Guild reason", true, false))
net:drain()
assert(officer.ns.KillStore("shared")["1\031new forever enemy"].note == "Guild reason")
officer.env.FlockSyncHelperDB.authorizedCollectorGuild.realm = "2"
raw.updatedAt, raw.note = math.floor(net.now) + 1, "Other server note"
net.now = net.now + 1
officer.ns.LoadServerKillList()
assert(officer.ns.KillStore("shared")[foreverKey].note == "Other server note",
    "A grant from another server of the same guild still imports the guild list")
print("Server helper import, officer redistribution, privacy, tombstones and Forever sharing: passed")
