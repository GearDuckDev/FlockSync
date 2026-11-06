local addonName, ns = ...

local lastRecap, deathGeneration = nil, 0
local function participant(guid)
    if type(guid) ~= "string" then return nil end
    for _, unit in ipairs({ "player", "party1", "party2", "party3", "party4" }) do
        if ns.KillReadable(UnitGUID(unit)) == guid then
            local name = ns.KillReadable(GetUnitName(unit, true))
            if type(name) == "string" and name ~= "" then return name end
        end
    end
    if IsInRaid and IsInRaid() then
        for index = 1, GetNumGroupMembers() do
            local unit = "raid" .. index
            if ns.KillReadable(UnitGUID(unit)) == guid then
                local name = ns.KillReadable(GetUnitName(unit, true))
                if type(name) == "string" and name ~= "" then return name end
            end
        end
    end
    for index = 1, GetNumGuildMembers() do
        local name, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, memberGuid = GetGuildRosterInfo(index)
        if ns.KillReadable(memberGuid) == guid then
            local readable = ns.KillReadable(name)
            if type(readable) == "string" then return readable end
        end
    end
end
function ns.RecordKillPartyEvent(actorGuid, victimGuid)
    actorGuid, victimGuid = ns.KillReadable(actorGuid), ns.KillReadable(victimGuid)
    if type(actorGuid) ~= "string" or type(victimGuid) ~= "string" then return end
    local target, actor = ns.KillObservedGuid(victimGuid), participant(actorGuid)
    if not target or not actor or not ns.KillMatch(target.name, target.realm) then return end
    ns.RecordKillObservation("KILL", target, {
        actorGuid = actorGuid, actor = actor, victimGuid = victimGuid, victim = target.name
    })
end

local function recapIdentity()
    if not C_DeathRecap or not C_DeathRecap.GetRecapLink then return nil end
    local ok, link = pcall(C_DeathRecap.GetRecapLink)
    if not ok then print("FlockSync: Death recap identity unavailable; no killer recorded."); return nil end
    link = ns.KillReadable(link)
    return type(link) == "string" and link:match("death:(%d+)") or nil
end
function ns.RecordKillDeathRecap(previousId, diedAt)
    if not ns.KillListEnabled() or not C_DeathRecap or not C_DeathRecap.GetRecapEvents then return false end
    local id = recapIdentity()
    if not id or id == previousId or id == lastRecap then return false end
    local ok, events = pcall(C_DeathRecap.GetRecapEvents)
    if not ok then print("FlockSync: Death recap unreadable; no killer recorded."); return false end
    events = ns.KillReadable(events)
    if type(events) ~= "table" or (issecrettable and issecrettable(events)) then return false end
    for _, entry in ipairs(events) do
        entry = ns.KillReadable(entry)
        if type(entry) == "table" and not (issecrettable and issecrettable(entry)) then
            local stamp, overkill = ns.KillReadable(entry.timestamp), ns.KillReadable(entry.overkill)
            local actorGuid, victimGuid = ns.KillReadable(entry.sourceGUID), ns.KillReadable(entry.destGUID)
            local hidden = issecretvalue and issecretvalue(entry.hideCaster) or entry.hideCaster == true
            if type(stamp) == "number" and math.abs(stamp - diedAt) <= 5
                and type(overkill) == "number" and overkill >= 0 and not hidden
                and victimGuid == ns.KillReadable(UnitGUID("player")) and type(actorGuid) == "string" then
                local target = ns.KillObservedGuid(actorGuid)
                if target and ns.KillMatch(target.name, target.realm) then
                    lastRecap = id
                    ns.RecordKillObservation("DEATH", target, {
                        actorGuid = actorGuid, actor = target.name,
                        victimGuid = victimGuid, victim = ns.GetPlayerFullName()
                    }, math.floor(stamp))
                    return true
                end
            end
        end
    end
    return false
end

local frame = CreateFrame("Frame")
for _, event in ipairs({ "PARTY_KILL", "PLAYER_DEAD", "PLAYER_ALIVE", "PLAYER_ENTERING_WORLD" }) do
    frame:RegisterEvent(event)
end
frame:SetScript("OnEvent", function(_, event, actorGuid, victimGuid)
    if not ns.IsOnboarded() or not ns.KillListEnabled() then return end
    if event == "PARTY_KILL" then ns.RecordKillPartyEvent(actorGuid, victimGuid)
    elseif event == "PLAYER_DEAD" then
        deathGeneration = deathGeneration + 1
        local generation, previous, diedAt = deathGeneration, lastRecap, GetServerTime()
        C_Timer.After(1, function()
            if generation ~= deathGeneration or ns.RecordKillDeathRecap(previous, diedAt) then return end
            C_Timer.After(2, function()
                if generation == deathGeneration and not ns.RecordKillDeathRecap(previous, diedAt) then
                    print("FlockSync: No readable, fresh killing-blow evidence for a listed enemy; death not attributed.")
                end
            end)
        end)
    else
        deathGeneration = deathGeneration + 1
        lastRecap = recapIdentity()
    end
end)
