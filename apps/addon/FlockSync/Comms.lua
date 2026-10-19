local addonName, ns = ...

local PREFIX = "FLOCKSYNC"
local SEND_INTERVAL = 0.5
local GUILD_RETRY_DELAY = 2
local GUILD_RETRY_LIMIT = 15

-- Outbound chunks wait here; a ticker sends exactly one every SEND_INTERVAL
-- seconds and is cancelled once the queue drains, so nothing runs while idle.
local sendQueue = {}
local ticker = nil

local function sendNext()
    local chunk = table.remove(sendQueue, 1)
    if chunk then
        C_ChatInfo.SendAddonMessage(PREFIX, chunk, "GUILD")
    end
    if #sendQueue == 0 and ticker then
        ticker:Cancel()
        ticker = nil
    end
end

local function enqueue(chunks)
    for _, chunk in ipairs(chunks) do
        sendQueue[#sendQueue + 1] = chunk
    end
    if not ticker and #sendQueue > 0 then
        ticker = C_Timer.NewTicker(SEND_INTERVAL, sendNext)
    end
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
function ns.WithGuildName(callback, attempt)
    local guildName = ns.CurrentGuildName()
    if guildName then
        callback(guildName)
    elseif IsInGuild() and (attempt or 0) < GUILD_RETRY_LIMIT then
        C_Timer.After(GUILD_RETRY_DELAY, function()
            ns.WithGuildName(callback, (attempt or 0) + 1)
        end)
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
    ns.WithGuildName(function(guildName)
        local payload = ns.Serialize({ updateType = updateType, data = data, guild = guildName })
        local _, chunks = ns.ChunkPayload(payload)
        enqueue(chunks)
    end)
end

local function canAggregate()
    return ns.IsPlayerOfficer()
end

-- Scans the player, aggregates locally when officer, then broadcasts if guilded.
function ns.PublishLocalScan()
    local character = ns.ScanPlayer()
    if not character then
        return nil
    end
    if canAggregate() then
        ns.MergeCharacter(character)
        FlockSyncDB.exportedAt = GetServerTime()
    end
    if IsInGuild() then
        ns.BroadcastUpdate("CHARACTER", character)
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
