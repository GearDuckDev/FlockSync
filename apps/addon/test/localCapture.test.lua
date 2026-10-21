local ns = {}
local frames, timers, messages = {}, {}, {}
local now, pants, officer, guilded, onboarded = 100, true, false, false, true
FlockSyncDB = {
    characters = {}, profiles = {}, accountCharacters = {}, staleCharacters = {},
    config = { hasCompletedOnboarding = true },
}
function CreateFrame()
    local frame = { events = {} }
    function frame:RegisterEvent(event) self.events[event] = true end
    function frame:SetScript(_, callback) self.callback = callback end
    frames[#frames + 1] = frame
    return frame
end
function UnitGUID() return "Player-Test" end
function GetUnitName() return "Tester" end
function GetRealmName() return "Realm" end
function UnitClass() return "Warrior", "WARRIOR", 1 end
function UnitLevel() return 60 end
function GetServerTime() return now end
function IsInGuild() return guilded end
function GetGuildInfo() return guilded and "Guild" or nil end
function GetInventoryItemLink(_, slot)
    if slot == 7 and pants then return "item:100" end
end
function GetInventoryItemID(_, slot)
    if slot == 7 and pants then return 100 end
end
C_Timer = {
    After = function(_, callback) timers[#timers + 1] = callback end,
    NewTicker = function() return { Cancel = function() end } end,
}
C_ChatInfo = {
    RegisterAddonMessagePrefix = function() end,
    SendAddonMessage = function() messages[#messages + 1] = true end,
}
ns.IsOnboarded = function() return onboarded end
ns.GetProfile = function()
    return { role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 1 } }
end
ns.IsPlayerOfficer = function() return officer end
ns.AttunementsEpoch = function() return 0 end
ns.ReviveStaleCharacter = function() end
ns.BuildAvailabilityPayload = function() end
ns.ScanLockouts = function() end
ns.BuildProfessionsPayload = function() end
ns.BuildGearGoalsPayload = function() end
ns.ScanAttunements = function() end
ns.RequestLockouts = function() end
ns.ShowStartupWindow = function() end
local function load(name)
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
load("Core")
load("Scanner")
load("Serializer")
load("Comms")
load("Events")
local function fire(event, ...)
    for _, frame in ipairs(frames) do
        if frame.events[event] then frame.callback(frame, event, ...) end
    end
end

ns.PublishLocalScan()
assert(FlockSyncDB.characters["Player-Test"].gear.items[1].slotId == 7)
assert(FlockSyncDB.characters["Player-Test"].lastSeenAt == 100)
now, pants = 200, false
fire("PLAYER_EQUIPMENT_CHANGED")
assert(#timers == 1)
-- Logout may happen before the debounced two-second equipment scan.
fire("PLAYER_LOGOUT")
local character = FlockSyncDB.characters["Player-Test"]
assert(#character.gear.items == 0, "Removed pants must disappear from the exported character")
assert(character.gear.updatedAt == 200)
assert(character.lastSeenAt == 200)
assert(FlockSyncDB.exportedAt == 200)
assert(#messages == 0, "Logout capture must not broadcast")
assert(FlockSyncDB.collectorGuild == nil, "Guildless scans must not request a collector grant")

ns.MergeCharacter({ guid = "Player-Test", gear = { updatedAt = 100, items = { { slotId = 7 } } }, lastSeenAt = 100 })
assert(#character.gear.items == 0, "Older guild echoes must not restore removed gear")
assert(character.lastSeenAt == 200)

guilded = true
ns.CaptureLocalScan()
assert(FlockSyncDB.collectorGuild.name == "Guild" and FlockSyncDB.collectorGuild.realm == "Realm")
local remote = { guid = "Other", name = "Other", realm = "Realm", gear = { updatedAt = 201, items = {} }, lastSeenAt = 201 }
local _, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.Other == nil, "Non-officers must not aggregate other characters")
officer = true
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.Other.lastSeenAt == 201, "Officers must still aggregate guild broadcasts")
load("Officer")
FlockSyncHelperDB = {
    isAuthorizedOfficer = true,
    authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
}
assert(ns.GetOfficerStatusReason() == "Website Officer/Admin (Same Guild)")
remote.guid = "WebsiteCollected"
_, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.WebsiteCollected, "Website-authorized low-rank alt must catch guild broadcasts")
FlockSyncHelperDB.authorizedCollectorGuild.realm = "OtherRealm"
remote.guid = "NotAuthorized"
_, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.NotAuthorized == nil, "Mismatched collector grant must not catch broadcasts")
onboarded, now = false, 300
fire("PLAYER_LOGOUT")
assert(character.lastSeenAt == 200, "Onboarding must still gate capture")
print("Local scan export, logout flush, empty gear, epochs and officer-only aggregation: passed")
