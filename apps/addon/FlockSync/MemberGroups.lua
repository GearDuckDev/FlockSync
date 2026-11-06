local addonName, ns = ...

function ns.VisibleScheduleRaids()
    if ns.KillLiveOfficer() then return ns.Snapshot.upcomingRaids end
    local links = ns.Snapshot.characterLinks
    local owner = links[UnitGUID("player")]
    if not owner then
        return {}, "Ask an officer/admin to link this character on the website, then sync and relay the snapshot."
    end
    local raids = {}
    for _, raid in ipairs(ns.Snapshot.upcomingRaids) do
        for _, assignment in ipairs(raid.assignments) do
            if links[assignment.characterGuid] == owner then
                raids[#raids + 1] = raid
                break
            end
        end
    end
    return raids, "No linked characters are assigned or benched in a scheduled raid."
end
