local net = assert(loadfile("apps/addon/test/helpers/killObservationNetwork.lua"))()
net.now = 10000000
local member = net:client("Member One", "P1", 5)
local officer = net:client("Officer Two", "P2", 1)
local item = net:addTarget(member, "Enemy Player")
net:addTarget(officer, "Enemy Player")
local function event(id, timestamp, kind)
    return { id = id, kind = kind or "KILL", name = "Enemy Player", realm = "Realm",
        targetGuid = "Enemy", targetCreatedAt = 90, timestamp = timestamp, zone = "Zone",
        reporterGuid = "P1", reporter = "Member One", actorGuid = "P1", actor = "Member One",
        victimGuid = "Enemy", victim = "Enemy Player" }
end
local store = member.ns.KillObservationStore("shared")
for index = 1, 5001 do store["limit" .. index] = event("limit" .. index, net.now - 10000 + index) end
store.expired = event("expired", net.now - 91 * 86400)
member.ns.PruneKillObservations("shared")
local count = 0
for _ in pairs(store) do count = count + 1 end
assert(count == 5000 and not store.limit1 and not store.expired and store.limit5001,
    "Exact battle cap keeps newest 5,000 and expires events outside 90 days")
local seen = event("seen", net.now - 91 * 86400, "SIGHTING")
seen.actorGuid, seen.actor, seen.victimGuid, seen.victim = nil, nil, nil, nil
assert(member.ns.MergeKillObservation(seen, "shared"))
assert(#member.ns.KillObservationRows(item, false) == 1, "Latest sighting survives battle retention")
local privateSeen = event("seen", net.now, "SIGHTING")
privateSeen.actorGuid, privateSeen.actor, privateSeen.victimGuid, privateSeen.victim = nil, nil, nil, nil
privateSeen.zone = "Private interval"
assert(member.ns.MergeKillObservation(privateSeen, "local"))
assert(member.ns.KillObservationRows(item, false)[1].zone == "Private interval",
    "New private-interval last-seen must not be hidden by old public report with same ID")
local invalid = event("invalid", net.now)
invalid.actorGuid = nil
assert(not member.ns.MergeKillObservation(invalid, "shared"))
invalid = event("future", net.now + 31)
assert(not member.ns.MergeKillObservation(invalid, "shared"), "Exact future-clock fence")
local shared = member.ns.KillObservationStore("shared")
member.env.FlockSyncDB.killListObservationsGuilds = nil
local fake = event("forged", net.now)
net:inject(member, member, { v = 1, guild = member.ns.KillGuildKey(), kind = "OBS_SNAP", entry = fake })
net:inject(officer, member, { v = 1, guild = officer.ns.KillGuildKey(), kind = "OBS_SNAP", entry = fake })
assert(next(officer.ns.KillObservationStore("shared")) == nil, "Member cannot claim officer snapshot authority")
member.env.FlockSyncDB.killListObservationsGuilds = { [member.ns.KillGuildKey()] = shared }
item.entry.deleted = true
member.ns.PruneKillObservations("shared")
member.ns.PruneKillObservations("local")
assert(next(member.ns.KillObservationStore("shared")) == nil and next(member.ns.KillObservationStore("local")) == nil,
    "Deletion clears both public and private-interval history associations")
local helperEvents = {}
for index = 1, 5000 do helperEvents[index] = event("helper" .. index, net.now - index * 6) end
officer.env.FlockSyncHelperDB = {
    isAuthorizedOfficer = true, authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
    sharedKillObservations = helperEvents,
}
local notifications = 0
officer.ns.OnKillListChanged(function() notifications = notifications + 1 end)
officer.ns.LoadServerKillObservations()
local officerItem = { key = item.key, entry = officer.ns.KillStore("shared")[item.key], destination = "shared" }
assert(#officer.ns.KillObservationRows(officerItem, true) == 5000 and notifications == 1,
    "Full helper imports enforce exact cap without thousands of UI redraws")
print("Exact 5,000/90-day limits, persistent latest sighting, local interval visibility, clock and snapshot authority: passed")
