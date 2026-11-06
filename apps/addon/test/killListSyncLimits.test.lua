local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local member = net:client("Member One", "P1", 5)
local officer = net:client("Officer Two", "P2", 1)
member.ns.SetKillSetting("enabled", true)
officer.ns.SetKillSetting("enabled", true)
assert(member.ns.SaveKillTarget("Draft Player", "Realm", "DO_NOT_BROADCAST", true, false))
net.now = 101
local key = "realm\031draft player"
local draft = member.ns.KillStore("shared")[key]
local item = { key = key, destination = "shared", entry = draft }
-- Fill a bounded queue and ensure failed publishing does not change the draft.
local source = { name = "Other Player", realm = "Realm", note = string.rep("x", 500),
    author = "Member One", authorGuid = "P1", actorGuid = "P1",
    createdAt = 101, updatedAt = 101, deleted = false }
local accepted = 0
while member.ns.SendKillEntry(source) do accepted = accepted + 1; assert(accepted < 100) end
assert(not member.ns.PublishKillDraft(item))
assert(not draft.sharedLive and member.ns.KillStore("shared")[key] == draft)
-- Guild-switch invalidation stops queued old-guild data being sent on the new guild channel.
member.guild = "Other Guild"
net:drain()
assert(#net.sent == 0)
member.guild = "Guild"
assert(member.ns.PublishKillDraft(item)); net:drain()
assert(officer.ns.KillStore("shared")[key])
-- A current-roster demotion cannot edit, even if a local website flag claims officer.
officer.rank = 5
officer.env.FlockSyncHelperDB = {
    isAuthorizedOfficer = true, authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
}
local officerItem = { key = key, destination = "shared", entry = officer.ns.KillStore("shared")[key] }
net.now = net.now + 1
assert(not officer.ns.ChangeKillTarget(officerItem, "Unauthorized edit", false))
assert(not officer.ns.CanChangeKill(officerItem, false))
officer.rank = 1
-- Exact duplicate parts and incomplete transfers remain bounded and eventually expire.
local unknown = net:client("Late Member", "P3", 5)
local prefix = "FLOCKKILL"
for id = 1, 100 do
    unknown.ns.ReceiveKillChunk(prefix, "200n" .. id .. ":1:24:incomplete", "GUILD", "Officer Two-Realm")
end
net.now = net.now + 31
assert(unknown.ns.RequestKillSync()); net:drain()
assert(unknown.ns.KillStore("shared")[key], "Expired incomplete transfers cannot permanently block catch-up")
-- Reset epochs prevent an old otherwise-authorized record restoring data.
local old = {}
for field, value in pairs(unknown.ns.KillStore("shared")[key]) do old[field] = value end
unknown.env.FlockSyncDB.databaseResetAt = math.floor(net.now)
unknown.env.FlockSyncDB.killListGuilds = nil
net:inject(unknown, officer, { v = 1, guild = unknown.ns.KillGuildKey(), kind = "SNAP", entry = old })
assert(not unknown.ns.KillStore("shared")[key])
-- Queue entries originating before a reset are not sent afterward.
local before = #net.sent
assert(member.ns.SendKillEntry(source))
member.env.FlockSyncDB.databaseResetAt = math.floor(net.now)
net:drain()
assert(#net.sent == before)
-- Setup completion starts catch-up, without requiring the master feature to be enabled.
unknown.env.FlockSyncDB.databaseResetAt = nil
net.now = net.now + 61
unknown.ns.StartKillSync(); net:drain()
assert(unknown.ns.KillStore("shared")[key])
assert(not unknown.ns.KillListEnabled())
print("Guild sync queue limits, guild changes, roster demotion, reassembly expiry, resets and opt-out passed")
