local addonName, ns = ...

local PREFIX = "FLOCKSYNC"
local SEND_INTERVAL = 0.5
local GUILD_RETRY_DELAY = 2
local GUILD_RETRY_LIMIT = 15
local HEARTBEAT_INTERVAL = 600

-- Outbound messages wait here; a ticker sends one chunk every SEND_INTERVAL
-- seconds and is cancelled once the queue drains, so nothing runs while idle.
-- Unstarted CHARACTER messages coalesce in-place so rapid UI edits never flood.
local sendQueue = {}
local ticker = nil
local lastBroadcastFingerprint = nil
local lastBroadcastAt = 0
local pendingCharacterData = nil
local characterRetryActive = false

local function sendNext()
    local head = sendQueue[1]
    if head then
        local chunk = head.chunks[head.index]
        head.index = head.index + 1
        if head.index > #head.chunks then
            table.remove(sendQueue, 1)
        end
        if chunk then
            C_ChatInfo.SendAddonMessage(PREFIX, chunk, "GUILD")
        end
    end
    if #sendQueue == 0 and ticker then
        ticker:Cancel()
        ticker = nil
    end
end

local function enqueue(chunks, updateType)
    if #chunks == 0 then
        return
    end
    if updateType == "CHARACTER" then
        for i = #sendQueue, 1, -1 do
            local entry = sendQueue[i]
            if entry.updateType == "CHARACTER" and entry.index == 1 then
                entry.chunks = chunks
                return
            end
        end
    end
    sendQueue[#sendQueue + 1] = {
        updateType = updateType,
        chunks = chunks,
        index = 1,
    }
    if not ticker then
        ticker = C_Timer.NewTicker(SEND_INTERVAL, sendNext)
    end
end

local function characterFingerprint(c)
    if type(c) ~= "table" then
        return ""
    end
    local r = type(c.role) == "table" and c.role or {}
    local gearItems = {}
    for i, item in ipairs(type(c.gear) == "table" and c.gear.items or {}) do
        gearItems[i] = { item.slotId or 0, item.itemId or 0, item.itemLink or "" }
    end
    local avail = type(c.availability) == "table" and c.availability or {}
    local sched = {}
    for i, day in ipairs(avail.schedule or {}) do
        sched[i] = { day.day or "", day.status or "", day.startTime or "", day.endTime or "" }
    end
    local locks = {}
    for i, lock in ipairs(type(c.lockouts) == "table" and c.lockouts.lockouts or {}) do
        locks[i] = {
            lock.instanceName or "", tostring(lock.instanceId or ""),
            lock.difficultyId or 0, lock.locked == true, lock.extended == true,
            lock.numEncounters or 0, lock.completedEncounters or 0,
        }
    end
    local profs = {}
    for i, p in ipairs(type(c.professions) == "table" and c.professions.primary or {}) do
        profs[i] = { p.name or "", p.level or 0, p.maxLevel or 0, p.acceptingRequests == true, p.recipes or {} }
    end
    local goals = {}
    for i, g in ipairs(type(c.gearGoals) == "table" and c.gearGoals.goals or {}) do
        goals[i] = { g.itemId or 0, g.itemLink or "", g.note or "" }
    end
    local att = {}
    for i, chain in ipairs(type(c.attunements) == "table" and c.attunements or {}) do
        local steps = {}
        for j, s in ipairs(chain.steps or {}) do
            steps[j] = s.completed == true and 1 or 0
        end
        att[i] = { chain.chainId or "", chain.isFullyAttuned == true, steps }
    end
    return ns.Serialize({
        c.guid or "", c.name or "", c.realm or "", c.classId or 0, c.level or 0,
        c.mainCharacterGuid or "", c.mainCharacterName or "", c.isActive ~= false,
        r.primaryRole or "", r.offSpecEnabled == true, r.offSpecRole or "",
        gearItems, avail.timezone or "", sched, locks, profs, goals, att,
    })
end

-- nil while unguilded or before the client has loaded guild info.
function ns.CurrentGuildName()
    if not IsInGuild() then
        return nil
    end
    local name = GetGuildInfo("player")
    if type(name) == "string" and name ~= "" then
        return name
    end
    return nil
end

-- Guild info can lag behind login; retry briefly before giving up.
function ns.WithGuildName(callback, attempt, onUnavailable)
    local guildName = ns.CurrentGuildName()
    if guildName then
        callback(guildName)
    elseif IsInGuild() and (attempt or 0) < GUILD_RETRY_LIMIT then
        C_Timer.After(GUILD_RETRY_DELAY, function()
            ns.WithGuildName(callback, (attempt or 0) + 1, onUnavailable)
        end)
    elseif onUnavailable then
        onUnavailable()
    end
end

-- Drops traffic from other guilds (e.g. alts in a different guild sharing
-- the account) and everything received while unguilded.
function ns.IsFromMyGuild(senderGuildName)
    local guildName = ns.CurrentGuildName()
    return guildName ~= nil and senderGuildName == guildName
end

-- "FULL_SCAN" rescans the player and broadcasts the result as a CHARACTER update.
function ns.BroadcastUpdate(updateType, data)
    if not ns.IsOnboarded() then
        return
    end
    if updateType == "FULL_SCAN" then
        ns.PublishLocalScan()
        return
    end
    if updateType == "CHARACTER" then
        pendingCharacterData = data
        if characterRetryActive then
            return
        end
        characterRetryActive = true
        ns.WithGuildName(function(guildName)
            characterRetryActive = false
            local latest = pendingCharacterData or data
            pendingCharacterData = nil
            lastBroadcastFingerprint = characterFingerprint(latest)
            lastBroadcastAt = GetServerTime()
            local payload = ns.Serialize({ updateType = "CHARACTER", data = latest, guild = guildName })
            local _, chunks = ns.ChunkPayload(payload)
            enqueue(chunks, "CHARACTER")
        end, nil, function()
            characterRetryActive = false
            pendingCharacterData = nil
            lastBroadcastFingerprint = nil
            lastBroadcastAt = 0
            print("FlockSync: Guild information unavailable; character broadcast skipped. A later scan can retry.")
        end)
        return
    end
    ns.WithGuildName(function(guildName)
        local payload = ns.Serialize({ updateType = updateType, data = data, guild = guildName })
        local _, chunks = ns.ChunkPayload(payload)
        enqueue(chunks, updateType)
    end)
end

local function canAggregate()
    return ns.IsPlayerOfficer()
end

function ns.CaptureLocalScan(preserveGear)
    local character = ns.ScanPlayer(preserveGear)
    if not character then
        return nil
    end
    -- Keep our own export fresh even when guild/officer information is unavailable.
    ns.MergeCharacter(character)
    local saved = FlockSyncDB.characters[character.guid]
    -- Local equipment events can share a server second; the latest local
    -- capture wins here without relaxing timestamps for guild/server merges.
    if saved and character.gear.updatedAt >= saved.gear.updatedAt then
        saved.gear = character.gear
    end
    FlockSyncDB.exportedAt = character.lastSeenAt
    return character
end

function ns.PublishLocalScan(onlyIfChanged)
    local character = ns.CaptureLocalScan()
    if not character then
        return nil
    end
    if IsInGuild() then
        local now = GetServerTime()
        local fingerprint = characterFingerprint(character)
        if not onlyIfChanged or fingerprint ~= lastBroadcastFingerprint
            or (now - lastBroadcastAt) >= HEARTBEAT_INTERVAL then
            ns.BroadcastUpdate("CHARACTER", character)
        end
    end
    return character
end

local function handleAddonMessage(_, _, prefix, chunk, _, sender)
    if prefix ~= PREFIX or not canAggregate() or not ns.CurrentGuildName() then
        return
    end
    local payload = ns.ReassembleChunk(chunk, sender)
    if not payload then
        return
    end
    local message = ns.Deserialize(payload)
    if type(message) ~= "table" or type(message.data) ~= "table"
        or not ns.IsFromMyGuild(message.guild) then
        return
    end
    if message.updateType == "LOOT" or message.updateType == "ATTENDANCE" then
        ns.MergeLedgerEntry(message.updateType, message.data)
        return
    end
    if message.updateType ~= "CHARACTER" then
        return
    end
    ns.MergeCharacter(message.data)
    FlockSyncDB.exportedAt = GetServerTime()
end

C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
local frame = CreateFrame("Frame")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", handleAddonMessage)
