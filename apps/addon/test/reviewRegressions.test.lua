local function loadModule(name, ns)
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end

local now, guild, guilded = 100, nil, true
local timers, ticker, messages, notices = {}, nil, {}, {}
function GetServerTime() return now end
function IsInGuild() return guilded end
function GetGuildInfo() return guild end
function CreateFrame()
    return { RegisterEvent = function() end, SetScript = function() end }
end
local realPrint = print
print = function(message) notices[#notices + 1] = message end
C_Timer = {
    After = function(_, callback) timers[#timers + 1] = callback end,
    NewTicker = function(_, callback)
        ticker = { callback = callback, Cancel = function(self) self.cancelled = true end }
        return ticker
    end,
}
C_ChatInfo = {
    RegisterAddonMessagePrefix = function() end,
    SendAddonMessage = function(_, chunk) messages[#messages + 1] = chunk end,
}
local function drainTimers()
    local count = 0
    while #timers > 0 do
        count = count + 1
        assert(count <= 20, "Guild retry must terminate")
        table.remove(timers, 1)()
    end
end
local ns = { IsOnboarded = function() return true end }
loadModule("Serializer", ns)
loadModule("Comms", ns)
ns.BroadcastUpdate("CHARACTER", { guid = "Me", level = 60 })
ns.BroadcastUpdate("CHARACTER", { guid = "Me", level = 61 })
assert(#timers == 1, "Concurrent updates must share the retry")
drainTimers()
assert(not ticker and #notices == 1, "Exhaustion must report the skipped broadcast")
guild = "Guild"
ns.BroadcastUpdate("CHARACTER", { guid = "Me", level = 62 })
assert(ticker, "Broadcast must recover after guild lookup exhaustion")
while not ticker.cancelled do ticker.callback() end
local decoded
for _, chunk in ipairs(messages) do
    local payload = ns.ReassembleChunk(chunk, "Me")
    if payload then decoded = ns.Deserialize(payload) end
end
assert(decoded.data.level == 62, "Recovery must send fresh data, not the failed pending update")

guild, ticker = nil, nil
ns.BroadcastUpdate("CHARACTER", { guid = "Me", level = 63 })
guilded = false
drainTimers()
assert(#notices == 2, "Leaving the guild during retries must finish the pending attempt")
guilded, guild = true, "NewGuild"
ns.BroadcastUpdate("CHARACTER", { guid = "Me", level = 64 })
assert(ticker, "Rejoining must permit broadcasts")
while not ticker.cancelled do ticker.callback() end
print = realPrint

local profile = { professions = { updatedAt = 10, list = {
    Alchemy = { name = "Alchemy", level = 100, maxLevel = 300, recipes = { 1 } },
    Tailoring = { name = "Tailoring", level = 100, maxLevel = 300, recipes = { 2 } },
} } }
local professionNS = { GetProfile = function() return profile end }
function GetProfessions() return 1 end
function GetProfessionInfo() return "Alchemy" end
loadModule("Professions", professionNS)
professionNS.ProfessionSummary()
local payload = professionNS.BuildProfessionsPayload()
assert(#payload.primary == 1 and payload.primary[1].name == "Alchemy")
assert(payload.updatedAt == now and payload.updatedAt > 10,
    "Summary pruning must export a newer epoch accepted by server conflict resolution")
now = now + 10
professionNS.ProfessionSummary()
assert(professionNS.BuildProfessionsPayload().updatedAt == payload.updatedAt,
    "Unchanged summaries must not continually advance the epoch")
profile.professions.list.Tailoring = {
    name = "Tailoring", level = 100, maxLevel = 300, recipes = { 2 },
}
assert(professionNS.BuildProfessionsPayload().updatedAt == now,
    "Payload-only pruning must advance the epoch too")

local itemNS = { ParseItemInput = function(link) return tonumber(link:match("item:(%d+)")) end }
FlockSyncDB = { itemSearchCache = {} }
function GetInventoryItemLink(_, slot)
    if slot == 1 then return "|Hitem:1|h[Own Helm]|h" end
end
loadModule("ItemSearch", itemNS)
for _ = 1, 5000 do itemNS.RefreshItemSearch() end
local function upvalue(fn, wanted)
    for index = 1, 100 do
        local name, value = debug.getupvalue(fn, index)
        if not name then break end
        if name == wanted then return value end
    end
    error("Missing test upvalue: " .. wanted)
end
local rememberLink = upvalue(itemNS.RefreshItemSearch, "rememberLink")
local remember = upvalue(rememberLink, "remember")
local store = upvalue(remember, "storeInMemory")
local order = upvalue(store, "order")
assert(#order == 1, "Repeated refreshes of one item must keep exactly one recency entry")
for id = 2, 2000 do rememberLink("|Hitem:" .. id .. "|h[Guild Item " .. id .. "]|h", false) end
itemNS.RefreshItemSearch()
rememberLink("|Hitem:2001|h[Newest Guild Item]|h", false)
assert(FlockSyncDB.itemSearchCache["1"], "Refreshing own item must protect it from oldest-item eviction")
assert(FlockSyncDB.itemSearchCache["2"] == nil, "The oldest unrefreshed item must be evicted")
assert(#order == 2000, "Recency bookkeeping must stay within the item limit")
for _ = 1, 5000 do itemNS.RefreshItemSearch() end
assert(#order == 2000, "Full caches must not grow on repeated personal-item refresh")
local seen = {}
for _, id in ipairs(order) do
    assert(not seen[id], "Recency queue must contain unique IDs")
    seen[id] = true
end
assert(#itemNS.FindGoalItems("Own Helm") == 1)
print("Guild retry recovery, profession pruning epochs and bounded item-search recency: passed")
