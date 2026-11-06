local net = assert(loadfile("apps/addon/test/helpers/killObservationNetwork.lua"))()
local member = net:client("Member One", "P1", 5)
local officer = net:client("Officer Two", "P2", 1)
local third = net:client("Member Three", "P3", 5)
local item = net:addTarget(member, "Enemy Player")
net:addTarget(officer, "Enemy Player")
net:addTarget(third, "Enemy Player")
member.units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = true, player = true }
member:fire("PLAYER_TARGET_CHANGED")
member:fire("PARTY_KILL", "P1", "Enemy-1")
local rows = member.ns.KillObservationRows(item, true)
assert(#rows == 1 and rows[1].actor == "Member One-Realm" and rows[1].victim == "Enemy Player")
member:fire("PARTY_KILL", "P1", "Enemy-1")
assert(#member.ns.KillObservationRows(item, true) == 1, "Duplicate battle is immutable/deduplicated")
member:fire("PARTY_KILL", "Unverified", "Enemy-1")
member:fire("PARTY_KILL", "P1", "Unobserved")
member:fire("PARTY_KILL", { secret = true }, "Enemy-1")
assert(#member.ns.KillObservationRows(item, true) == 1, "Unknown participants and secret GUIDs never guessed")
officer.units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = true, player = true }
officer:fire("PLAYER_TARGET_CHANGED")
officer:fire("PARTY_KILL", "P1", "Enemy-1")
assert(officer.ns.KillObservationRows(item, true)[1].id ~= rows[1].id,
    "Independent observers need distinct immutable report IDs before cross-observer battle deduplication")
net:drain()
assert(#officer.ns.KillObservationRows(item, true) == 1)
assert(#third.ns.KillObservationRows(item, true) == 1)
local raw = rows[1]
net:inject(third, member, { v = 1, guild = third.ns.KillGuildKey(), kind = "OBS",
    entry = { id = "spoof", kind = "SIGHTING", name = raw.name, realm = raw.realm,
        targetGuid = raw.targetGuid, targetCreatedAt = 90, timestamp = math.floor(net.now),
        zone = "Spoof", reporterGuid = "P2", reporter = "Officer Two" } })
assert(third.ns.KillObservationRows(item, false)[1].zone ~= "Spoof", "Sender cannot impersonate reporter")
local malformed = { id = 1 }
third.ns.KillObservationStore("shared").bad = malformed
third.ns.PruneKillObservations("shared")
assert(third.ns.KillObservationStore("shared").bad == nil, "Malformed saved records safely pruned")
local recap = { timestamp = math.floor(net.now), overkill = 0, hideCaster = false,
    sourceGUID = "Enemy-1", destGUID = "P1" }
member.env.C_DeathRecap = {
    GetRecapLink = function() return "death:12" end,
    GetRecapEvents = function() return { recap } end,
}
recap.overkill = -1
assert(not member.ns.RecordKillDeathRecap("11", math.floor(net.now)), "Nonfatal hit cannot name a killer")
recap.overkill = 0
recap.timestamp = math.floor(net.now) - 60
assert(not member.ns.RecordKillDeathRecap("11", math.floor(net.now)), "Old recap cannot be reused")
recap.timestamp = math.floor(net.now)
recap.sourceGUID = { secret = true }
assert(not member.ns.RecordKillDeathRecap("11", math.floor(net.now)), "Secret source skipped")
recap.sourceGUID = "Enemy-1"
assert(member.ns.RecordKillDeathRecap("11", math.floor(net.now)), "Explicit fresh fatal evidence records death")
assert(not member.ns.RecordKillDeathRecap("11", math.floor(net.now)), "Same recap cannot create another death")
assert(#member.ns.KillObservationRows(item, true) == 2)
net:drain()
assert(#officer.ns.KillObservationRows(item, true) == 2)
member.ns.SetKillSetting("historyEnabled", false)
net.now = net.now + 10
member:fire("PARTY_KILL", "P1", "Enemy-1")
assert(#member.ns.KillObservationRows(item, true) == 3, "Hiding history does not stop reports")
member.ns.SetKillSetting("reportEnabled", false)
net.now = net.now + 10
member:fire("PARTY_KILL", "P1", "Enemy-1")
assert(#member.ns.KillObservationRows(item, true) == 4, "Report toggle preserves local history")
net:drain()
assert(#officer.ns.KillObservationRows(item, true) == 3, "Report toggle stops new shared observations")
local saved = officer.ns.KillObservationRows(item, true)
third.env.FlockSyncDB.killListObservationsGuilds = nil
officer.ns.RespondKillObservations()
net:drain()
assert(#third.ns.KillObservationRows(item, true) == #saved, "Native officer recovers late-client history")
officer.env.FlockSyncHelperDB = {
    isAuthorizedOfficer = true, authorizedCollectorGuild = { name = "Other", realm = "Realm" },
    sharedKillObservations = saved,
}
officer.env.FlockSyncDB.killListObservationsGuilds = nil
officer.ns.LoadServerKillObservations()
assert(next(officer.ns.KillObservationStore("shared")) == nil, "Cross-guild helper observations excluded")
officer.env.FlockSyncHelperDB.authorizedCollectorGuild.name = "Guild"
officer.env.FlockSyncDB.databaseResetAt = math.floor(net.now) + 1
officer.ns.LoadServerKillObservations()
assert(#officer.ns.KillObservationRows(item, true) == #saved, "Restored helper retains original historical times across reset")
item.entry.createdAt = math.floor(net.now)
member.ns.PruneKillObservations("shared")
assert(next(member.ns.KillObservationStore("shared")) == nil, "New target creation cannot inherit old reports")
net.now = net.now + 91 * 86400
officer.ns.PruneKillObservations("shared")
assert(#officer.ns.KillObservationRows(item, true) == 0, "Battle retention expires after 90 days")
local dying = net:client("Dying Four", "P4", 5)
local dyingItem = net:addTarget(dying, "Enemy Player")
local recapId, deathStamp = "30", math.floor(net.now)
dying.env.C_DeathRecap = {
    GetRecapLink = function() return "death:" .. recapId end,
    GetRecapEvents = function() return { { timestamp = deathStamp, overkill = 0,
        sourceGUID = "Enemy-1", destGUID = "P4", hideCaster = false } } end,
}
dying:fire("PLAYER_ENTERING_WORLD")
dying.units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = true, player = true }
dying:fire("PLAYER_TARGET_CHANGED")
recapId = "31"
dying:fire("PLAYER_DEAD")
net:drain()
assert(#dying.ns.KillObservationRows(dyingItem, true) == 1, "Real event hook reads delayed death recap")
assert(dying.ns.KillObservationRows(dyingItem, true)[1].timestamp == deathStamp, "Record fatal evidence time, not timer time")
dying:fire("PLAYER_DEAD")
net:drain()
assert(#dying.ns.KillObservationRows(dyingItem, true) == 1, "Repeated death without new recap never guesses")
print("Verified battles, strict attribution, deduplication, guild authority, helper recovery and retention: passed")
