local addonName, ns = ...

local responding = false
function ns.ReceiveKillObservation(entry, member, snapshot)
    if not ns.ValidateKillObservation(entry) then return end
    if snapshot then
        if not member.officer then return end
    elseif entry.reporterGuid ~= member.guid
        or ns.NormalizeCharacterName(entry.reporter) ~= ns.NormalizeCharacterName(member.name) then return end
    ns.MergeKillObservation(entry, "shared", snapshot)
end

function ns.RespondKillObservations()
    local member = ns.KillGuildMember(ns.GetPlayerFullName())
    if responding or not member or not ns.IsOnboarded() then return end
    ns.PruneKillObservations("shared")
    local store, rows, guild = ns.KillObservationStore("shared"), {}, ns.KillGuildKey()
    for _, entry in pairs(store or {}) do
        if member.officer or entry.reporterGuid == member.guid then rows[#rows + 1] = entry end
    end
    table.sort(rows, function(a, b) return a.timestamp > b.timestamp end)
    responding = true
    local index = 1
    local function step()
        local current = ns.KillGuildMember(ns.GetPlayerFullName())
        if guild ~= ns.KillGuildKey() or store ~= ns.KillObservationStore("shared")
            or not current or current.officer ~= member.officer then responding = false; return end
        local entry = rows[index]
        if not entry then responding = false; return end
        local ok, message = ns.SendKillMessage(member.officer and "OBS_SNAP" or "OBS", entry)
        if not ok then
            responding = false
            print("FlockSync: Observation catch-up incomplete: " .. message)
            return
        end
        index = index + 1
        C_Timer.After(math.max(2, math.ceil(#ns.Serialize(entry) / 180) * 0.5 + 1), step)
    end
    step()
end

function ns.LoadServerKillObservations()
    local helper = FlockSyncHelperDB
    local guild = type(helper) == "table" and helper.authorizedCollectorGuild
    if type(guild) ~= "table" or helper.isAuthorizedOfficer ~= true
        or guild.name ~= ns.CurrentGuildName() or guild.realm ~= GetRealmName() then return end
    local changed = false
    for _, entry in ipairs(type(helper.sharedKillObservations) == "table" and helper.sharedKillObservations or {}) do
        if ns.ValidateKillObservation(entry) then
            changed = ns.MergeKillObservation(entry, "shared", true, true) or changed
        else print("FlockSync: Invalid server observation; update the matching server/Desktop candidate.") end
    end
    ns.PruneKillObservations("shared")
    if changed then ns.KillListChanged() end
end
