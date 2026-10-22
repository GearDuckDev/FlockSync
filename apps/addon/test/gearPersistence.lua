local ns = {}
local clock, guid = 100, "Player-Main"
local inventory = { [7] = { itemId = 100, itemLink = "item:100" } }
local profiles = {}
local frames, timers = {}, {}
FlockSyncDB = { characters = {}, accountCharacters = {} }

function GetServerTime() return clock end
function UnitGUID() return guid end
function UnitName() return guid end
function GetRealmName() return "Realm" end
function UnitClass() return "Warrior", "WARRIOR", 1 end
function UnitLevel() return 60 end
function IsInGuild() return false end
function GetInventoryItemID(_, slot) return inventory[slot] and inventory[slot].itemId end
function GetInventoryItemLink(_, slot) return inventory[slot] and inventory[slot].itemLink end
function GetInventoryItemTexture(_, slot) return inventory[slot] and "texture" end
function CreateFrame()
    local frame = { events = {} }
    function frame:RegisterEvent(event) self.events[event] = true end
    function frame:SetScript(_, callback) self.callback = callback end
    frames[#frames + 1] = frame
    return frame
end
C_ChatInfo = { RegisterAddonMessagePrefix = function() end }
C_Timer = { After = function(_, callback) timers[#timers + 1] = callback end }
ns.IsOnboarded = function() return true end
ns.GetPlayerFullName = function() return guid end
ns.RegisterAccountCharacter = function() end
ns.FormatCharacterLabel = function(name, realm) return name .. " (" .. realm .. ")" end
ns.GetProfile = function()
    if not profiles[guid] then
        profiles[guid] = {
            role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = clock },
            gear = { items = {}, updatedAt = 0 },
        }
    end
    return profiles[guid]
end
for _, name in ipairs({
    "BuildAvailabilityPayload", "ScanLockouts", "BuildProfessionsPayload",
    "BuildGearGoalsPayload", "ScanAttunements", "RequestLockouts", "ShowStartupWindow",
}) do
    ns[name] = function() end
end
ns.AttunementsEpoch = function() return 0 end
ns.ReviveStaleCharacter = function() end
local sep = package.config:sub(1, 1)
for _, name in ipairs({ "Core.lua", "Scanner.lua", "Comms.lua", "Events.lua" }) do
    local file = table.concat({ "apps", "addon", "FlockSync", name }, sep)
    assert(loadfile(file))("FlockSync", ns)
end
local function event(name, ...)
    for _, frame in ipairs(frames) do
        if frame.events[name] then frame.callback(frame, name, ...) end
    end
end
local function savedGear(characterGuid)
    return FlockSyncDB.characters[characterGuid or guid].gear
end

ns.CaptureLocalScan()
assert(#savedGear().items == 1)
local gearEpoch = savedGear().updatedAt
clock = 101
inventory = {}
event("PLAYER_LOGOUT")
assert(#savedGear().items == 1, "Logout/reload must preserve gear when inventory disappears")
assert(savedGear().updatedAt == gearEpoch, "Logout must not invent a newer gear snapshot")
assert(FlockSyncDB.exportedAt == 101, "Logout must capture the saved export")
ns.CaptureLocalScan()
assert(#savedGear().items == 1, "An unavailable empty inventory must not clear prior gear")

guid = "Player-Alt"
clock = 102
inventory = { [1] = { itemId = 200, itemLink = "item:200" } }
event("PLAYER_ENTERING_WORLD", true, false)
ns.CaptureLocalScan()
assert(savedGear().items[1].itemId == 200)
assert(savedGear("Player-Main").items[1].itemId == 100, "Changing characters preserves the main")
inventory = {}
event("PLAYER_LOGOUT")
assert(savedGear().items[1].itemId == 200, "Alt logout also preserves gear")

clock = 103
inventory = { [1] = { itemId = 300, itemLink = "item:300" } }
event("PLAYER_EQUIPMENT_CHANGED", 1, true)
inventory = {}
event("PLAYER_LOGOUT")
assert(savedGear().items[1].itemId == 300, "Immediate logout must not outrun equipment capture")
event("PLAYER_EQUIPMENT_CHANGED", 1, false)
event("PLAYER_LOGOUT")
assert(#savedGear().items == 0, "Two local equipment events within one second must both persist")
clock = 104
event("PLAYER_EQUIPMENT_CHANGED", 1, false)
event("PLAYER_LOGOUT")
assert(#savedGear().items == 0, "Explicit removal of the final item must still save empty gear")

clock = 105
inventory = { [1] = { itemId = 400, itemLink = "item:400" } }
ns.CaptureLocalScan()
gearEpoch = savedGear().updatedAt
clock = 106
inventory = { [1] = { itemId = 400 } }
ns.CaptureLocalScan()
assert(savedGear().items[1].itemId == 400, "Uncached item links must not clear gear")
assert(savedGear().updatedAt == gearEpoch)
event("PLAYER_EQUIPMENT_CHANGED", 1, true)
event("PLAYER_LOGOUT")
assert(savedGear().items[1].itemId == 400, "An uncached equipment event must retain prior gear")
print("Gear persistence: character switch, reload/logout, immediate changes, unequips, and cache gaps passed")
