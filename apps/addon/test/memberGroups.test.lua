local ns = {
    Snapshot = { characterLinks = { P1 = "Alice", P2 = "Alice", P3 = "Bob" }, upcomingRaids = {
        { id = "main", assignments = { { characterGuid = "P1" } } },
        { id = "bench", assignments = { { characterGuid = "P2", isBench = true } } },
        { id = "other", assignments = { { characterGuid = "P3" } } },
    } },
}
local officer, guid = false, "P1"
function UnitGUID() return guid end
ns.KillLiveOfficer = function() return officer end
assert(loadfile("apps/addon/FlockSync/MemberGroups.lua"))("FlockSync", ns)
local raids = ns.VisibleScheduleRaids()
assert(#raids == 2 and raids[1].id == "main" and raids[2].id == "bench")
guid = "P3"
raids = ns.VisibleScheduleRaids()
assert(#raids == 1 and raids[1].id == "other")
guid = "Unlinked"
local message
raids, message = ns.VisibleScheduleRaids()
assert(#raids == 0 and message:find("link this character"))
officer = true
assert(#ns.VisibleScheduleRaids() == 3)
officer, guid = false, "P1"
ns.Snapshot.characterLinks.P2 = nil
assert(#ns.VisibleScheduleRaids() == 1, "Revoked alt no longer grants bench visibility")
print("In-game verified linked-character schedule filter: passed")
