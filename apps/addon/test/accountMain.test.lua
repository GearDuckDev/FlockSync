local ns, current = {}, "Player-1-P1"
local names = { ["Player-1-P1"] = "Main One", ["Player-1-P2"] = "Alt Two", ["Player-1-P3"] = "Alt Three" }
local env = setmetatable({
    FlockSyncDB = {},
    UnitGUID = function() return current end,
    UnitName = function() return names[current] end,
    GetUnitName = function() return names[current] .. "-Realm" end,
    GetNormalizedRealmName = function() return "Realm" end,
    GetRealmName = function() return "Realm" end,
    UnitClass = function() return "Warrior", "WARRIOR", 1 end,
    UnitLevel = function() return 60 end,
    GetServerTime = function() return 100 end,
    CreateFrame = function() return { RegisterEvent = function() end, SetScript = function() end } end,
}, { __index = _G })
env._G = env
for _, name in ipairs({ "Config", "Ruleset", "RealmMigration", "Core" }) do
    local chunk = assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))
    setfenv(chunk, env)("FlockSync", ns)
end
ns.InitializeDatabase()
local function login(guid)
    current = guid
    ns.RegisterAccountCharacter()
    return ns.GetProfile()
end

local first = login("Player-1-P1")
assert(ns.GetAccountMain().guid == "Player-1-P1" and first.mainCharacterGuid == nil, "First character starts as Main")
local second = login("Player-1-P2")
assert(ns.GetAccountMain().guid == "Player-1-P1" and second.mainCharacterGuid == "Player-1-P1", "Alts show the account Main")
assert(ns.SetAccountMain("Player-1-P2"))
first = login("Player-1-P1")
assert(ns.GetAccountMain().guid == "Player-1-P2" and first.mainCharacterGuid == "Player-1-P2", "Main change applies on login")
local third = login("Player-1-P3")
assert(third.mainCharacterGuid == "Player-1-P2", "New characters use the account Main")
assert(ns.RemoveAccountCharacter("Player-1-P2"))
assert(ns.GetAccountMain().guid == "Player-1-P3" and third.mainCharacterGuid == nil,
    "Removing the Main chooses one current fallback")

env.FlockSyncDB = { profiles = {
    ["Player-1-P1"] = { mainCharacterGuid = "Player-1-P3", mainCharacterName = "Alt Three", role = {}, gear = {} },
    ["Player-1-P2"] = { mainCharacterGuid = "Player-1-P1", mainCharacterName = "Main One", role = {}, gear = {} },
    ["Player-1-P3"] = { role = {}, gear = {} },
}, accountCharacters = {
    ["Player-1-P1"] = { guid = "Player-1-P1", name = "Main One" },
    ["Player-1-P2"] = { guid = "Player-1-P2", name = "Alt Two" },
    ["Player-1-P3"] = { guid = "Player-1-P3", name = "Alt Three" },
} }
ns.InitializeDatabase()
current = "Player-1-P2"
ns.GetProfile()
assert(env.FlockSyncDB.accountMain.guid == "Player-1-P1", "Migration keeps the logged-in character's Main")
assert(env.FlockSyncDB.profiles["Player-1-P3"].mainCharacterGuid == "Player-1-P1", "Migration updates every profile")
print("Account-wide Main selection, migration and removal fallback passed")
