local network = { now = 1000, clients = {}, timers = {}, sent = {} }
function network:client(name, guild, helper)
    local env = setmetatable({}, { __index = _G })
    local client = { ns = {}, env = env, guild = guild, name = name, frames = {}, online = true }
    self.clients[#self.clients + 1] = client
    env._G, env.FlockSyncDB, env.FlockSyncHelperDB = env, {}, helper
    env.GetServerTime = function() return math.floor(self.now) end
    env.IsInGuild = function() return client.guild ~= nil end
    env.CreateFrame = function()
        local frame = { events = {} }
        function frame:RegisterEvent(event) self.events[event] = true end
        function frame:SetScript(_, callback) self.callback = callback end
        client.frames[#client.frames + 1] = frame
        return frame
    end
    env.C_Timer = { After = function(seconds, callback)
        self.timers[#self.timers + 1] = { at = self.now + seconds, callback = callback }
    end }
    env.C_ChatInfo = {
        RegisterAddonMessagePrefix = function() end,
        SendAddonMessage = function(prefix, chunk, channel)
            assert(#chunk <= 250)
            self.sent[#self.sent + 1] = { prefix = prefix, chunk = chunk, client = client }
            for _, peer in ipairs(self.clients) do
                if peer.online and peer.guild == client.guild then
                    peer:fire("CHAT_MSG_ADDON", prefix, chunk, channel, name)
                end
            end
        end
    }
    env.Enum = { TooltipDataType = { Item = 1 } }
    env.TooltipDataProcessor = { AddTooltipPostCall = function(_, callback) client.tooltip = callback end }
    local ns = client.ns
    ns.CurrentGuildName = function() return client.guild end
    ns.WithGuildName = function(callback) if client.guild then callback(client.guild) end end
    ns.IsFromMyGuild = function(value) return value == client.guild end
    ns.NormalizeCharacterName = function(value) return value:lower() end
    ns.GetPlayerFullName = function() return name end
    ns.IsOnboarded = function() return client.onboarded ~= false end
    ns.IsPlayerOfficer = function() return false end
    ns.IsEnabled = function() return true end
    ns.CacheAddonReleases, ns.CompactAddonReleases = function() end, function() end
    for _, module in ipairs({ "Serializer", "Snapshot", "SnapshotComms", "Tooltips" }) do
        local chunk = assert(loadfile("apps/addon/FlockSync/" .. module .. ".lua"))
        setfenv(chunk, env)("FlockSync", ns)
    end
    function client:fire(event, ...)
        for _, frame in ipairs(self.frames) do
            if frame.events[event] then frame.callback(frame, event, ...) end
        end
    end
    return client
end
function network:drain()
    local count = 0
    while #self.timers > 0 do
        count = count + 1; assert(count < 10000)
        table.sort(self.timers, function(a, b) return a.at < b.at end)
        local timer = table.remove(self.timers, 1)
        self.now = timer.at; timer.callback()
    end
end
return network
