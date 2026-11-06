local ns, now, guid, guild, realm, rank = {}, 100, "Player-1", "Guild", "Realm", 5
function UnitGUID() return guid end
function UnitName() return "Creator Name" end
function GetUnitName() return "Creator Name" end
function GetNormalizedRealmName() return realm end
function GetRealmName() return realm end
function GetGuildInfo() return guild, "Rank", rank end
function GetServerTime() return now end
function CreateFrame() return { RegisterEvent = function() end, SetScript = function() end } end
ns.CurrentGuildName = function() return guild end
ns.IsOnboarded = function() return true end
FlockSyncDB = { config = {}, characters = {}, profiles = {}, accountCharacters = {}, staleCharacters = {} }
for _, name in ipairs({ "Core", "KillListText", "KillList", "KillListActions" }) do
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
local function add(note, shared, personal) return ns.SaveKillTarget("Enemy Name", realm, note, shared, personal) end
assert(not ns.KillListEnabled())
assert(not add("", true, false))
ns.SetKillSetting("enabled", true)
assert(not add("", false, false))
assert(not add(string.rep("x", 501), true, true))
local unicode = string.char(240, 159, 152, 128)
assert(ns.ValidateKillTarget("Enemy", realm, string.rep(unicode, 500)))
assert(not ns.ValidateKillTarget("Enemy", realm, string.rep(unicode, 501)))
for _, text in ipairs({ "\128", "\192\128", "\237\160\128", "\244\144\128\128", "\240" }) do
    assert(not ns.KillTextLength(text), "Malformed Unicode must fail")
end
assert(ns.KillPreview(string.rep(unicode, 81)) == string.rep(unicode, 77) .. "...")
assert(ns.KillPreview("a\nb|c") == "a b||c")
assert(add("Reason", true, true))
local key = "realm\031enemy name"
local personal, shared = ns.KillStore("personal"), ns.KillStore("shared")
assert(personal[key] ~= shared[key], "Copies must not alias")
assert(not add("Duplicate", true, true))
local privateItem = { key = key, destination = "personal", entry = personal[key] }
local sharedItem = { key = key, destination = "shared", entry = shared[key] }
assert(not ns.ChangeKillTarget(privateItem, "Too soon", false))
now = 101
assert(ns.ChangeKillTarget(privateItem, "Private edit", false))
assert(shared[key].note == "Reason")
assert(not ns.ChangeKillTarget(sharedItem, "Creator cannot edit", false))
ns.SetKillSetting("personalEnabled", false)
assert(#ns.KillEntries() == 1 and personal[key])
ns.SetKillSetting("personalEnabled", true)
guid = "Player-2"
assert(not ns.KillListEnabled(), "Per-character opt-in")
ns.SetKillSetting("enabled", true)
assert(not ns.KillStore("personal")[key])
assert(not ns.ChangeKillTarget(sharedItem, "", true))
ns.debugOfficerOverride, FlockSyncDB.config.forceOfficerMode = true, true
assert(not ns.KillOfficer(), "Debug collector flags cannot grant kill-list authority")
FlockSyncHelperDB = { isAuthorizedOfficer = true, authorizedCollectorGuild = { name = guild, realm = "Other" } }
assert(not ns.KillOfficer())
FlockSyncHelperDB.authorizedCollectorGuild.realm = realm
assert(ns.KillOfficer())
FlockSyncHelperDB = nil
rank, now = 1, 102
assert(ns.ChangeKillTarget(sharedItem, "Officer edit", false))
assert(shared[key].authorGuid == "Player-1")
guid, rank, now = "Player-1", 5, 103
assert(ns.ChangeKillTarget(sharedItem, "", true))
assert(shared[key].deleted and personal[key].note == "Private edit")
assert(not add("Too soon", true, false))
now = 104
assert(add("Re-added", true, false))
guild = "Other"
assert(next(ns.KillStore("shared")) == nil)
guild, realm = "Guild", "Other"
assert(next(ns.KillStore("shared")) == nil)
guild, realm = nil, "Realm"
assert(not ns.SaveKillTarget("New", realm, "", true, true))
assert(not personal["realm\031new"], "Both-list add is atomic")
ns.SetKillSetting("enabled", false)
assert(#ns.KillEntries() == 0 and personal[key])
ns.CacheAddonReleases, ns.RegisterAccountCharacter = function() end, function() end
assert(loadfile("apps/addon/FlockSync/Snapshot.lua"))("FlockSync", ns)
assert(ns.ApplyDatabaseReset(104))
assert(FlockSyncDB.killListGuilds == nil and ns.KillStore("personal")[key])
guid = "Player-2"
ns.RemoveAccountCharacter("Player-1")
assert(FlockSyncDB.killListCharacters["Player-1"] == nil)
print("Kill-list Unicode, permissions, isolation, atomicity, epochs and reset tests passed")
