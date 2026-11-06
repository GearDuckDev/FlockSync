local addonName, ns = ...

local observed, lastSighting = {}, {}
function ns.KillReadable(value)
    if issecretvalue and issecretvalue(value) then return nil end
    return value
end
function ns.KillObservedGuid(guid)
    if type(guid) ~= "string" then return nil end
    local entry = observed[guid]
    return entry and GetServerTime() - entry.at <= 300 and entry or nil
end
function ns.KillMatch(name, realm)
    local key = realm:lower() .. "\031" .. name:lower()
    for _, item in ipairs(ns.KillEntries()) do
        if item.key == key then return item end
    end
end
function ns.KillZone()
    local zone = ns.KillReadable(GetRealZoneText and GetRealZoneText())
    return type(zone) == "string" and zone ~= "" and zone or "Unknown zone"
end
function ns.RecordKillObservation(kind, target, participants, timestamp)
    if not ns.IsOnboarded() or not ns.KillListEnabled() then return end
    local now, reporterGuid = timestamp or GetServerTime(), ns.KillReadable(UnitGUID("player"))
    local reporter = ns.GetPlayerFullName()
    if type(reporterGuid) ~= "string" or type(reporter) ~= "string" then return end
    for _, item in ipairs(ns.KillEntries()) do
        if item.entry.name:lower() == target.name:lower() and item.entry.realm == target.realm
            and (item.destination ~= "shared" or item.entry.sharedLive) then
            local entry = {
                kind = kind, name = item.entry.name, realm = target.realm, targetGuid = target.guid,
                targetCreatedAt = item.entry.createdAt, timestamp = now, zone = ns.KillZone(),
                reporterGuid = reporterGuid, reporter = reporter,
            }
            if participants then
                entry.actorGuid, entry.actor = participants.actorGuid, participants.actor
                entry.victimGuid, entry.victim = participants.victimGuid, participants.victim
            end
            entry.id = kind == "SIGHTING" and ("S:" .. target.guid)
                or (kind .. ":" .. now .. ":" .. reporterGuid .. ":" .. target.guid)
            if item.destination == "personal" then ns.MergeKillObservation(entry, "personal")
            elseif not ns.GetKillState().reportEnabled then ns.MergeKillObservation(entry, "local")
            elseif ns.MergeKillObservation(entry, "shared") then
                local ok, message = ns.SendKillMessage("OBS", entry)
                if not ok then print("FlockSync: Observation saved locally; delivery failed: " .. message) end
            end
        end
    end
end

function ns.ObserveKillUnit(unit)
    if not ns.IsOnboarded() or not ns.KillListEnabled() then return end
    if ns.KillReadable(UnitIsPlayer(unit)) ~= true
        or ns.KillReadable(UnitIsEnemy("player", unit)) ~= true then return end
    local target = ns.KillUnitTarget(unit)
    local guid = ns.KillReadable(UnitGUID(unit))
    if not target or type(guid) ~= "string" or guid == "" then return end
    target.guid, target.at = guid, GetServerTime()
    for key, entry in pairs(observed) do
        if target.at - entry.at > 300 then observed[key] = nil end
    end
    for key, stamp in pairs(lastSighting) do
        if target.at - stamp > 300 then lastSighting[key] = nil end
    end
    local count = 0
    for _ in pairs(observed) do count = count + 1 end
    if count >= 256 and not observed[guid] then return end
    observed[guid] = target
    local item = ns.KillMatch(target.name, target.realm)
    if not item then return end
    if not lastSighting[guid] or target.at - lastSighting[guid] >= 60 then
        lastSighting[guid] = target.at
        ns.RecordKillObservation("SIGHTING", target)
    end
    if ns.ShowKillAlert then ns.ShowKillAlert(target) end
    if ns.UpdateKillSkull then ns.UpdateKillSkull(unit, true) end
end

local frame = CreateFrame("Frame")
for _, event in ipairs({ "PLAYER_TARGET_CHANGED", "UPDATE_MOUSEOVER_UNIT", "PLAYER_FOCUS_CHANGED",
    "NAME_PLATE_UNIT_ADDED", "NAME_PLATE_UNIT_REMOVED", "PLAYER_ENTERING_WORLD", "PLAYER_GUILD_UPDATE" }) do
    frame:RegisterEvent(event)
end
frame:SetScript("OnEvent", function(_, event, unit)
    if event == "PLAYER_GUILD_UPDATE" or event == "PLAYER_ENTERING_WORLD" then
        observed, lastSighting = {}, {}
        if ns.ResetKillAlerts then ns.ResetKillAlerts() end
        return
    end
    if event == "NAME_PLATE_UNIT_REMOVED" then
        if ns.UpdateKillSkull then ns.UpdateKillSkull(unit, false) end
        return
    end
    if event == "NAME_PLATE_UNIT_ADDED" and ns.UpdateKillSkull then ns.UpdateKillSkull(unit, true) end
    local token = event == "PLAYER_TARGET_CHANGED" and "target"
        or event == "UPDATE_MOUSEOVER_UNIT" and "mouseover"
        or event == "PLAYER_FOCUS_CHANGED" and "focus" or unit
    if type(token) == "string" then ns.ObserveKillUnit(token) end
end)
ns.OnKillListChanged(function()
    if ns.RefreshKillSkulls then ns.RefreshKillSkulls() end
end)
