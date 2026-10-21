local addonName, ns = ...

-- Relays the desktop-sourced snapshot to guild members who have no desktop app.
-- Uses its own prefix so its slow pacing never delays character broadcasts.
local PREFIX = "FLOCKSNAP"
local SEND_INTERVAL = 1.0
local RESEND_COOLDOWN = 120
local REQ_COOLDOWN = 30
local queue, sending = {}, false
local lastSentAt, responsePending = 0, false
local remoteTransferUntil, lastReqSeenAt = 0, 0

local function sendNext()
    local chunk = table.remove(queue, 1)
    if not chunk then
        sending = false
        return
    end
    C_ChatInfo.SendAddonMessage(PREFIX, chunk, "GUILD")
    if #queue > 0 then
        sending = true
        C_Timer.After(SEND_INTERVAL, sendNext)
    else
        sending = false
    end
end

local function send(message)
    if not ns.IsOnboarded() then
        return
    end
    ns.WithGuildName(function(guildName)
        message.guild = guildName
        local _, chunks = ns.ChunkPayload(ns.Serialize(message))
        for _, chunk in ipairs(chunks) do
            queue[#queue + 1] = chunk
        end
        if not sending then
            sendNext()
        end
    end)
end

-- Recipes are grouped per crafter so the guild broadcast stays small.
local function compact(source)
    local byGuid, crafters = {}, {}
    for _, entry in ipairs(ns.Snapshot.craftersIndex) do
        local crafter = byGuid[entry.characterGuid]
        if not crafter then
            crafter = { g = entry.characterGuid, n = entry.characterName,
                m = entry.mainCharacterName, k = entry.classId, l = entry.level, i = {} }
            byGuid[entry.characterGuid] = crafter
            crafters[#crafters + 1] = crafter
        end
        crafter.i[#crafter.i + 1] = entry.itemIdOrSpellId
    end
    local goals = {}
    for itemId, needs in pairs(ns.Snapshot.goalsByItem) do
        goals[#goals + 1] = { i = itemId, n = needs }
    end
    return { t = source.serverTimestamp, c = crafters, r = ns.Snapshot.upcomingRaids,
        g = goals, u = ns.CompactAddonReleases() }
end

local function expand(data)
    if type(data) ~= "table" or type(data.t) ~= "number" then
        return nil
    end
    local craftersIndex = {}
    for _, crafter in ipairs(type(data.c) == "table" and data.c or {}) do
        if type(crafter) == "table" and type(crafter.i) == "table" then
            for _, id in ipairs(crafter.i) do
                craftersIndex[#craftersIndex + 1] = {
                    itemIdOrSpellId = id, characterGuid = crafter.g,
                    characterName = crafter.n, mainCharacterName = crafter.m,
                    classId = crafter.k, level = crafter.l,
                }
            end
        end
    end
    local goalMatches = {}
    for _, goal in ipairs(type(data.g) == "table" and data.g or {}) do
        if type(goal) == "table" then
            goalMatches[#goalMatches + 1] = { itemId = goal.i, neededBy = goal.n }
        end
    end
    return { serverTimestamp = data.t, craftersIndex = craftersIndex,
        upcomingRaids = type(data.r) == "table" and data.r or {}, goalMatches = goalMatches,
        addonReleases = data.u }
end

local function canShare()
    return ns.Snapshot.origin == "helper" and ns.GetSnapshotSource() ~= nil
end

local function broadcastSnapshot()
    responsePending = false
    local now = GetServerTime()
    if not canShare() or sending or now < remoteTransferUntil
        or now - lastSentAt < RESEND_COOLDOWN then
        return
    end
    lastSentAt = now
    send({ k = "SNAP", d = compact(ns.GetSnapshotSource()) })
end

local function isSelf(sender)
    return ns.NormalizeCharacterName(sender) == ns.NormalizeCharacterName(ns.GetPlayerFullName())
end

local function handleMessage(_, prefix, chunk, _, sender)
    if prefix ~= PREFIX or isSelf(sender) or not ns.CurrentGuildName() then
        return
    end
    local now = GetServerTime()
    if ns.PeekChunkHeader then
        local _, part, total = ns.PeekChunkHeader(chunk)
        if total and total > 1 then
            -- Another officer is already streaming a multi-chunk SNAP; yield the channel.
            responsePending = false
            local finishAt = now + (total - part + 1) * SEND_INTERVAL + 5
            if finishAt > remoteTransferUntil then
                remoteTransferUntil = finishAt
            end
        end
    end
    local payload = ns.ReassembleChunk(chunk, sender, 600)
    if not payload then
        return
    end
    local message = ns.Deserialize(payload)
    if type(message) ~= "table" or not ns.IsFromMyGuild(message.guild) then
        return
    end
    if message.k == "SNAP" then
        local source = expand(message.d)
        if source and source.serverTimestamp >= ns.Snapshot.serverTimestamp then
            -- Someone already shared an equal or newer copy; skip our reply.
            lastSentAt = now
            remoteTransferUntil = 0
            responsePending = false
            ns.ApplyBroadcastSnapshot(source, message.guild)
        end
    elseif message.k == "REQ" and type(message.t) == "number" then
        if message.t <= ns.Snapshot.serverTimestamp then
            lastReqSeenAt = now
        end
        if message.t < ns.Snapshot.serverTimestamp and canShare()
            and not responsePending and now >= remoteTransferUntil then
            responsePending = true
            C_Timer.After(2 + math.random() * 6, broadcastSnapshot)
        end
    end
end

C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
local frame = CreateFrame("Frame")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function(_, event, ...)
    if event == "CHAT_MSG_ADDON" then
        handleMessage(nil, ...)
        return
    end
    -- Delays let the snapshot load and the guild channel come up after login.
    C_Timer.After(5, function()
        if IsInGuild() then
            ns.WithGuildName(ns.EnforceSnapshotGuild)
        else
            ns.EnforceSnapshotGuild(nil)
        end
    end)
    C_Timer.After(15, function()
        local now = GetServerTime()
        if now >= remoteTransferUntil and (lastReqSeenAt == 0 or now - lastReqSeenAt >= REQ_COOLDOWN) then
            send({ k = "REQ", t = ns.Snapshot.serverTimestamp })
        end
    end)
    C_Timer.After(30, broadcastSnapshot)
end)
