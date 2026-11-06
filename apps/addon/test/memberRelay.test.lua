local network = assert(loadfile("apps/addon/test/helpers/memberRelay.lua"))()
local source = {
    isAuthorizedOfficer = true, serverTimestamp = network.now, craftersIndex = {},
    authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
    characterLinks = { { characterGuid = "Goal-1", ownerKey = "LegacyAccount" } },
    goalMatches = { { itemId = 123, neededBy = {
        { characterGuid = "Goal-1", characterName = "Goal Member", classId = 1 }
    } } },
    upcomingRaids = { { id = "raid", name = "Shared Raid", assignments = {} } },
}
for index = 1, 80 do
    source.craftersIndex[index] = {
        itemIdOrSpellId = 122 + index, characterGuid = "Crafter-1",
        characterName = "Guild Crafter", mainCharacterName = "Crafter Main", classId = 8, level = 60,
    }
end
local officer = network:client("Collector", "Guild", source)
local member = network:client("Member", "Guild")
local outsider = network:client("Outsider", "Other Guild")
officer.ns.LoadSnapshot()
member:fire("PLAYER_LOGIN")
network:drain()
assert(member.ns.HasSnapshot(), "Ordinary member must automatically receive snapshot without helper")
assert(member.ns.Snapshot.origin == "broadcast")
assert(member.ns.Snapshot.characterLinks == nil, "Legacy assignment data is ignored")
member.env.date = function(format, timestamp)
    assert(format == "%m-%d-%Y %H:%M", "Snapshot date must use MM-DD-YYYY and retain time")
    assert(timestamp == source.serverTimestamp)
    return "11-05-2026 22:28"
end
assert(member.ns.DescribeSnapshot() == "Guild snapshot from guild officer, 11-05-2026 22:28")
assert(member.ns.Snapshot.craftersByItem[123][1].characterName == "Guild Crafter")
assert(member.ns.Snapshot.goalsByItem[123][1].characterName == "Goal Member")
assert(#member.ns.Snapshot.upcomingRaids == 1, "Full group delivery remains explicitly allowed")
for _, message in ipairs(network.sent) do
    local payload = member.ns.ReassembleChunk(message.chunk, message.client.name, 600)
    if payload then
        local decoded = member.ns.Deserialize(payload)
        if decoded and decoded.k == "SNAP" then assert(decoded.d.o == nil, "Relay omits legacy assignment data") end
    end
end
assert(not outsider.ns.HasSnapshot(), "Other guild must not receive relay")
assert(member.env.FlockSyncHelperDB == nil and not member.ns.IsPlayerOfficer())
local lines = {}
member.tooltip({ AddLine = function(_, line) lines[#lines + 1] = line end }, { id = 123 })
assert(#lines == 2, "Member tooltip must show both crafting and goal data")
assert(lines[1]:find("Goal Member") and lines[2]:find("Guild Crafter"))
for _, message in ipairs(network.sent) do
    assert(message.prefix == "FLOCKSNAP" and #message.chunk <= 250)
end
local late = network:client("Late Member", "Guild")
network.now = network.now + 180
late:fire("PLAYER_LOGIN")
network:drain()
assert(late.ns.Snapshot.craftersByItem[123], "Late member automatically catches up")
assert(late.ns.Snapshot.goalsByItem[123])
local malicious = {
    k = "SNAP", guild = "Guild", d = { t = math.floor(network.now) + 1,
        c = {}, g = {}, r = {}, o = { { characterGuid = "Attacker", ownerKey = "LegacyAccount" } } },
}
local _, chunks = member.ns.ChunkPayload(member.ns.Serialize(malicious))
for _, chunk in ipairs(chunks) do late:fire("CHAT_MSG_ADDON", "FLOCKSNAP", chunk, "GUILD", "Member") end
assert(late.ns.Snapshot.characterLinks == nil, "Legacy relay fields are discarded")
member.ns.Snapshot.serverTimestamp = 0
member.ns.Snapshot.craftersByItem = {}
member.ns.Snapshot.goalsByItem = {}
member.ns.LoadSnapshot()
assert(member.ns.Snapshot.goalsByItem[123], "Cached guild snapshot survives reload without helper")
member.guild = "Other Guild"
member.ns.EnforceSnapshotGuild("Other Guild")
assert(not member.ns.HasSnapshot(), "Guild change hides old member snapshot")
member.ns.LoadSnapshot()
assert(not member.ns.HasSnapshot(), "Reload must not reintroduce a previous guild's cached ownership")
assert(next(member.ns.Snapshot.craftersByItem) == nil)
assert(next(member.ns.Snapshot.goalsByItem) == nil)
local switched = network:client("Switched Alt", "Guild")
switched.env.FlockSyncDB.guildSnapshot = {
    guild = "Guild", serverTimestamp = network.now,
    authorizedCollectorGuild = { name = "Guild", realm = "Other Realm" },
    characterLinks = source.characterLinks,
}
switched.ns.LoadSnapshot()
assert(not switched.ns.HasSnapshot(), "Same guild name on another realm must not restore a stale snapshot")
officer.env.GetRealmName = function() return "Other Realm" end
officer.ns.EnforceSnapshotGuild("Guild")
assert(not officer.ns.HasSnapshot(), "Realm change must hide a previously loaded helper")
print("Member crafting/goal relay, tooltip, late join and guild isolation: passed")
