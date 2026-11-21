local ns, current = {}, "P1"
local names = { P1 = "Main One", P2 = "Alt Two", P3 = "Alt Three" }
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
for _, name in ipairs({ "Config", "Ruleset", "Core" }) do
    local chunk = assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))
    setfenv(chunk, env)("FlockSync", ns)
end
ns.InitializeDatabase()
local function login(guid)
    current = guid
    ns.RegisterAccountCharacter()
    return ns.GetProfile()
end

local first = login("P1")
assert(ns.GetAccountMain().guid == "P1" and first.mainCharacterGuid == nil, "First character starts as Main")
local second = login("P2")
assert(ns.GetAccountMain().guid == "P1" and second.mainCharacterGuid == "P1", "Alts show the account Main")
assert(ns.SetAccountMain("P2"))
first = login("P1")
assert(ns.GetAccountMain().guid == "P2" and first.mainCharacterGuid == "P2", "Main change applies on login")
local third = login("P3")
assert(third.mainCharacterGuid == "P2", "New characters use the account Main")
assert(ns.RemoveAccountCharacter("P2"))
assert(ns.GetAccountMain().guid == "P3" and third.mainCharacterGuid == nil,
    "Removing the Main chooses one current fallback")

env.FlockSyncDB = { profiles = {
    P1 = { mainCharacterGuid = "P3", mainCharacterName = "Alt Three", role = {}, gear = {} },
    P2 = { mainCharacterGuid = "P1", mainCharacterName = "Main One", role = {}, gear = {} },
    P3 = { role = {}, gear = {} },
}, accountCharacters = {
    P1 = { guid = "P1", name = "Main One" },
    P2 = { guid = "P2", name = "Alt Two" },
    P3 = { guid = "P3", name = "Alt Three" },
} }
ns.InitializeDatabase()
current = "P2"
ns.GetProfile()
assert(env.FlockSyncDB.accountMain.guid == "P1", "Migration keeps the logged-in character's Main")
assert(env.FlockSyncDB.profiles.P3.mainCharacterGuid == "P1", "Migration updates every profile")
print("Account-wide Main selection, migration and removal fallback passed")
