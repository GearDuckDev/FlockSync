local addonName, ns = ...

local RETENTION_SECONDS = 30 * 24 * 60 * 60
local EPIC_COLORS = { a335ee = true, ff8000 = true, e6cc80 = true }
local lastBoss = { name = nil, at = 0 }

function ns.GetLedger()
    if type(FlockSyncDB.guildLedger) ~= "table" then
        FlockSyncDB.guildLedger = { loot = {}, attendance = {} }
    end
    if type(FlockSyncDB.guildLedger.loot) ~= "table" then
        FlockSyncDB.guildLedger.loot = {}
    end
    if type(FlockSyncDB.guildLedger.attendance) ~= "table" then
        FlockSyncDB.guildLedger.attendance = {}
    end
    return FlockSyncDB.guildLedger
end

-- The backend keeps permanent history; locally only the last 30 days stay.
function ns.PruneLedger()
    local ledger = ns.GetLedger()
    local cutoff = GetServerTime() - RETENTION_SECONDS
    for _, key in ipairs({ "loot", "attendance" }) do
        local kept = {}
        for _, entry in ipairs(ledger[key]) do
            if type(entry) == "table" and type(entry.timestamp) == "number"
                and entry.timestamp >= cutoff then
                kept[#kept + 1] = entry
            end
        end
        ledger[key] = kept
    end
end

local function hasEntry(list, id)
    for _, entry in ipairs(list) do
        if entry.id == id then
            return true
        end
    end
    return false
end

local function validLoot(e)
    return type(e) == "table" and type(e.id) == "string"
        and type(e.itemId) == "number" and type(e.itemLink) == "string"
        and type(e.recipientName) == "string" and type(e.instanceName) == "string"
        and type(e.timestamp) == "number"
end

local function validAttendance(e)
    return type(e) == "table" and type(e.id) == "string"
        and type(e.instanceName) == "string" and type(e.timestamp) == "number"
        and type(e.rosterGuids) == "table"
end

-- Returns true when the entry was new.
function ns.MergeLedgerEntry(kind, entry)
    local ledger = ns.GetLedger()
    local list, valid
    if kind == "LOOT" then
        list, valid = ledger.loot, validLoot
    elseif kind == "ATTENDANCE" then
        list, valid = ledger.attendance, validAttendance
    else
        return false
    end
    if not valid(entry) or hasEntry(list, entry.id) then
        return false
    end
    list[#list + 1] = entry
    FlockSyncDB.exportedAt = GetServerTime()
    return true
end

local function canRecord()
    return ns.IsPlayerOfficer()
end

local function record(kind, entry)
    if ns.MergeLedgerEntry(kind, entry) and IsInGuild() then
        ns.BroadcastUpdate(kind, entry)
    end
end

local function onEncounterEnd(encounterId, encounterName, _, _, success)
    if success ~= 1 or not canRecord() or not IsInRaid() then
        return
    end
    local now = GetServerTime()
    lastBoss.name, lastBoss.at = encounterName, now
    local instanceName = GetInstanceInfo() or "Unknown"
    local roster = {}
    for i = 1, GetNumGroupMembers() do
        local guid = UnitGUID("raid" .. i)
        if guid then
            roster[#roster + 1] = guid
        end
    end
    record("ATTENDANCE", {
        id = string.format("A%d-%d", encounterId or 0, math.floor(now / 60)),
        instanceName = instanceName,
        timestamp = now,
        rosterGuids = roster,
        benchGuids = {},
    })
end

local function onLoot(message, _, _, _, _, _, _, _, _, _, _, guid)
    if not canRecord() or type(message) ~= "string" then
        return
    end
    local inInstance, instanceType = IsInInstance()
    if not inInstance or instanceType ~= "raid" then
        return
    end
    local link = message:match("(|c%x+|Hitem:.-|h%[.-%]|h|r)")
    if not link then
        return
    end
    local color = link:match("|cff(%x%x%x%x%x%x)")
    if not (color and EPIC_COLORS[color:lower()]) then
        return
    end
    local itemId = tonumber(link:match("|Hitem:(%d+)"))
    if not itemId then
        return
    end
    local name = message:match("^(.-) receives? loot")
    if not name or name == "You" then
        name = UnitName("player")
        guid = UnitGUID("player")
    end
    local now = GetServerTime()
    local boss = (now - lastBoss.at) <= 600 and lastBoss.name or nil
    record("LOOT", {
        id = string.format("L%s-%d-%d", name, itemId, math.floor(now / 60)),
        itemId = itemId,
        itemLink = link,
        recipientGuid = type(guid) == "string" and guid or "",
        recipientName = name,
        instanceName = GetInstanceInfo() or "Unknown",
        bossName = boss,
        timestamp = now,
    })
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("ENCOUNTER_END")
frame:RegisterEvent("CHAT_MSG_LOOT")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function(_, event, ...)
    if event == "ENCOUNTER_END" then
        onEncounterEnd(...)
    elseif event == "CHAT_MSG_LOOT" then
        onLoot(...)
    elseif event == "PLAYER_ENTERING_WORLD" then
        ns.PruneLedger()
    end
end)
