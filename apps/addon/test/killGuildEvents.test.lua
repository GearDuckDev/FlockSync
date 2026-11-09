local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local client = net:client("Member One", "P1", 5)
net:client("Officer Two", "P2", 1)
local requests, ns = 0, client.ns
ns.LoadSnapshot = function() end
local request = ns.RequestKillSync
ns.RequestKillSync = function(...) requests = requests + 1; return request(...) end
local function throttleNotices()
    local count = 0
    for _, notice in ipairs(net.notices) do
        if notice:find("Wait one minute", 1, true) then count = count + 1 end
    end
    return count
end

-- Login plus the player's own guild update starts one catch-up, not one per event.
client:fire("PLAYER_LOGIN")
client:fire("PLAYER_GUILD_UPDATE", "player")
client:fire("PLAYER_GUILD_UPDATE")
net:drain()
assert(requests == 1, "Login starts exactly one catch-up, got " .. requests)

-- Nearby players' guild updates (nameplates, targets) never start catch-up.
for index = 1, 20 do client:fire("PLAYER_GUILD_UPDATE", "nameplate" .. index) end
client:fire("PLAYER_GUILD_UPDATE", "target")
client:fire("PLAYER_GUILD_UPDATE", "mouseover")
net:drain()
assert(requests == 1, "Other units' guild updates must not request catch-up")
assert(throttleNotices() == 0, "No throttle spam from automatic catch-up")

-- Automatic catch-up inside the throttle window stays quiet.
net.now = net.now + 5
ns.StartKillSync(); net:drain()
assert(requests == 2 and throttleNotices() == 0, "Throttled automatic catch-up is silent")

-- Manual /fs kill sync still explains the throttle.
assert(not ns.RequestKillSync())
assert(throttleNotices() == 1, "Manual sync reports the throttle")

-- A real guild change still restarts catch-up for the new guild.
client.guild = "Other Guild"
client:fire("PLAYER_GUILD_UPDATE", "player"); net:drain()
assert(requests == 4, "Guild change starts a new catch-up")
assert(throttleNotices() == 1, "Guild change resets the throttle")
print("Own-guild event filtering, single login catch-up and quiet automatic throttling passed")
