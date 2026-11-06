local ns = {
    Snapshot = { characterLinks = { P1 = "Alice", P2 = "Alice", P3 = "Bob" }, upcomingRaids = {
        { id = "main", assignments = { { characterGuid = "P1" } } },
        { id = "bench", assignments = { { characterGuid = "P2", isBench = true } } },
        { id = "other", assignments = { { characterGuid = "P3" } } },
    } },
}
assert(loadfile("apps/addon/FlockSync/MemberGroups.lua"))("FlockSync", ns)
local raids = ns.VisibleScheduleRaids()
assert(#raids == 3, "All guild members see every scheduled raid")
ns.Snapshot.characterLinks = nil
assert(#ns.VisibleScheduleRaids() == 3, "Legacy assignment data does not affect schedule visibility")
print("In-game schedule visibility is independent of account assignment data: passed")
