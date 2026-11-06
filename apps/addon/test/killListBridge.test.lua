local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local officer = net:client("Officer Two", "P2", 1)
local member = net:client("Member One", "P1", 5)
local chunk = assert(loadfile("apps/addon/FlockSync/KillListBridge.lua"))
setfenv(chunk, officer.env)("FlockSync", officer.ns)
local raw = {
    name = "Enemy Player", realm = "Realm", author = "Member One", authorGuid = "P1",
    actorGuid = "P1", note = "Server note", createdAt = 90, updatedAt = 95, deleted = false,
}
officer.env.FlockSyncHelperDB = {
    isAuthorizedOfficer = true, authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
    sharedKillList = { raw },
}
officer.ns.EnforceSnapshotGuild = function() end
officer.ns.LoadSnapshot = function() end
member.ns.LoadSnapshot = function() end
officer:fire("PLAYER_LOGIN")
member:fire("PLAYER_LOGIN")
local key = "realm\031enemy player"
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
print("Server helper kill-list import, officer redistribution, privacy and tombstones: passed")
