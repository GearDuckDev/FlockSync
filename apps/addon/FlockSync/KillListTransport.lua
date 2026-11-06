local addonName, ns = ...

local PREFIX, MAX_PARTS, MAX_QUEUE = "FLOCKKILL", 24, 256
local queue, running, transfers, requestTimes = {}, false, {}, {}
local lastWarning, lastRequest = -60, -60

local function warn(message)
    if GetServerTime() - lastWarning >= 10 then
        lastWarning = GetServerTime()
        print("FlockSync: Kill-list sync: " .. message)
    end
end

local function sendNext()
    local item = table.remove(queue, 1)
    if item and item.guild == ns.KillGuildKey() and ns.IsOnboarded()
        and item.reset == FlockSyncDB.databaseResetAt then
        C_ChatInfo.SendAddonMessage(PREFIX, item.chunk, "GUILD")
    end
    if #queue > 0 then C_Timer.After(0.5, sendNext) else running = false end
end

function ns.SendKillMessage(kind, entry)
    if not ns.IsOnboarded() or not ns.KillGuildKey() then
        return false, "Guild information unavailable or setup incomplete."
    end
    local source = ns.Serialize({ v = 1, guild = ns.KillGuildKey(), kind = kind, entry = entry })
    if #source > 4600 then return false, "Kill-list message is too large." end
    local _, chunks = ns.ChunkPayload(source)
    if #chunks > MAX_PARTS or #queue + #chunks > MAX_QUEUE then
        return false, "Kill-list sending queue is full. Wait for it to drain, then retry."
    end
    for _, chunk in ipairs(chunks) do
        queue[#queue + 1] = { chunk = chunk, guild = ns.KillGuildKey(), reset = FlockSyncDB.databaseResetAt }
    end
    if not running then running = true; C_Timer.After(0.5, sendNext) end
    return true
end

local function assemble(chunk, sender)
    if type(chunk) ~= "string" or #chunk > 250 then return nil end
    local id, part, total, data = ns.PeekChunkHeader(chunk)
    if not id or total > MAX_PARTS then return nil end
    local now, count = GetServerTime(), 0
    for key, transfer in pairs(transfers) do
        if now - transfer.started > 30 then transfers[key] = nil else count = count + 1 end
    end
    local key = sender .. "/" .. id
    local transfer = transfers[key]
    if not transfer then
        if count >= 16 then warn("Too many incoming transfers; request sync again later."); return nil end
        transfer = { total = total, parts = {}, count = 0, bytes = 0, started = now }
        transfers[key] = transfer
    end
    if transfer.total ~= total then transfers[key] = nil; return nil end
    if not transfer.parts[part] then
        transfer.parts[part], transfer.count = data, transfer.count + 1
        transfer.bytes = transfer.bytes + #data
    end
    if transfer.bytes > 4600 then transfers[key] = nil; return nil end
    if transfer.count ~= total then return nil end
    transfers[key] = nil
    return table.concat(transfer.parts)
end

function ns.ReceiveKillChunk(prefix, chunk, channel, sender)
    if prefix ~= PREFIX or channel ~= "GUILD" or not ns.IsOnboarded() then return end
    local member = ns.KillGuildMember(sender)
    if not member or member.guid == UnitGUID("player") then return end
    local source = assemble(chunk, member.guid)
    if not source then return end
    local message = ns.Deserialize(source)
    if type(message) ~= "table" or message.v ~= 1 or message.guild ~= ns.KillGuildKey() then return end
    if message.kind == "REQ" then
        local now = GetServerTime()
        if now - (requestTimes[member.guid] or -60) < 60 then return end
        requestTimes[member.guid] = now
        C_Timer.After(2 + math.random() * 4, ns.RespondKillSync)
    elseif (message.kind == "OBS" or message.kind == "OBS_SNAP") and ns.ReceiveKillObservation then
        ns.ReceiveKillObservation(message.entry, member, message.kind == "OBS_SNAP")
    elseif message.kind == "UPDATE" or message.kind == "SNAP" then
        if not ns.MergeKillWire(message.entry, member, message.kind == "SNAP") then
            -- Equal/older records are expected during catch-up; validation never mutates them.
            return
        end
    end
end

function ns.RequestKillSync()
    local now = GetServerTime()
    if now - lastRequest < 60 then
        print("FlockSync: Wait one minute between kill-list catch-up requests.")
        return false
    end
    local ok, message = ns.SendKillMessage("REQ")
    if not ok then print("FlockSync: " .. message); return false end
    lastRequest = now
    return true
end

function ns.ResetKillTransport()
    queue, transfers, requestTimes = {}, {}, {}
    lastRequest = -60
end

C_ChatInfo.RegisterAddonMessagePrefix(PREFIX)
local frame = CreateFrame("Frame")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", function(_, _, ...) ns.ReceiveKillChunk(...) end)
