local network = { now = 100, clients = {}, timers = {}, sent = {}, notices = {} }
function network:client(name, guid, rank)
    local env = setmetatable({}, { __index = _G })
    local client = { env = env, ns = {}, name = name, guid = guid, rank = rank, guild = "Guild", online = true }
    self.clients[#self.clients + 1] = client
    env._G = env
    env.FlockSyncDB = { config = { hasCompletedOnboarding = true }, profiles = {},
        characters = {}, accountCharacters = {}, staleCharacters = {} }
    env.UnitGUID = function() return guid end
    env.GetRealmName = function() return "Realm" end
    env.GetNormalizedRealmName = function() return "Realm" end
    env.GetUnitName = function() return name .. "-Realm" end
    env.UnitName = function() return name end
    env.GetServerTime = function() return math.floor(self.now) end
    env.GetGuildInfo = function() return client.guild, "Rank", client.rank end
    env.print = function(message) self.notices[#self.notices + 1] = message end
    env.GetNumGuildMembers = function() return #self.clients end
    env.GetGuildRosterInfo = function(index)
        local peer = self.clients[index]
        if peer.guild ~= client.guild then return nil end
        return peer.name .. "-Realm", "Rank", peer.rank, nil, nil, nil, nil, nil,
            peer.online, nil, nil, nil, nil, nil, nil, nil, peer.guid
    end
    env.CreateFrame = function()
        return { RegisterEvent = function() end, SetScript = function() end }
    end
    env.C_Timer = { After = function(delay, callback)
        self.timers[#self.timers + 1] = { at = self.now + delay, callback = callback }
    end }
    env.C_ChatInfo = {
        RegisterAddonMessagePrefix = function() end,
        SendAddonMessage = function(prefix, chunk, channel)
            assert(#chunk <= 250)
            self.sent[#self.sent + 1] = { prefix = prefix, chunk = chunk, sender = client }
            for _, peer in ipairs(self.clients) do
                if peer.online and peer.guild == client.guild then
                    peer.ns.ReceiveKillChunk(prefix, chunk, channel, name .. "-Realm")
                end
            end
        end,
    }
    local ns = client.ns
    ns.CurrentGuildName = function() return client.guild end
    ns.IsOnboarded = function() return env.FlockSyncDB.config.hasCompletedOnboarding end
    ns.RequestGuildRoster = function() end
    ns.NormalizeCharacterName = function(value)
        return type(value) == "string" and value:gsub("%-Realm$", ""):lower() or nil
    end
    for _, module in ipairs({ "Core", "Serializer", "KillListText", "KillList", "KillListActions",
        "KillListAuthority", "KillListTransport", "KillListSync" }) do
        local chunk = assert(loadfile("apps/addon/FlockSync/" .. module .. ".lua"))
        setfenv(chunk, env)("FlockSync", ns)
    end
    return client
end
function network:drain()
    local count = 0
    while #self.timers > 0 do
        count = count + 1; assert(count < 10000, "Timers must terminate")
        table.sort(self.timers, function(a, b) return a.at < b.at end)
        local timer = table.remove(self.timers, 1)
        self.now = timer.at; timer.callback()
    end
end
function network:inject(receiver, sender, message, channel)
    local _, chunks = sender.ns.ChunkPayload(sender.ns.Serialize(message))
    for _, chunk in ipairs(chunks) do
        receiver.ns.ReceiveKillChunk("FLOCKKILL", chunk, channel or "GUILD", sender.name .. "-Realm")
    end
end
return network
