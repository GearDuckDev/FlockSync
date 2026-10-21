local ns = {}
local guild, realm, rank, native = "Guild", "Realm", 9, false
function IsInGuild() return guild ~= nil end
function GetGuildInfo() return guild, "Member", rank end
function GetRealmName() return realm end
C_GuildInfo = { CanViewOfficerNote = function() return native end }
assert(loadfile("apps/addon/FlockSync/Officer.lua"))("FlockSync", ns)
FlockSyncDB = { config = { forceOfficerMode = false }, officerGuilds = {} }
FlockSyncHelperDB = { isAuthorizedOfficer = true }
assert(not ns.IsPlayerOfficer(), "Unscoped desktop bootstrap must not authorize arbitrary guilds")
FlockSyncHelperDB.authorizedCollectorGuild = { name = "Guild", realm = "Realm" }
assert(ns.GetOfficerStatusReason() == "Website Officer/Admin (Same Guild)")
assert(next(FlockSyncDB.officerGuilds) == nil, "Website authorization must not become permanent native permission")
rank = 10
assert(ns.IsPlayerOfficer(), "Low-ranked alts on the account must collect for the linked guild")
guild = "Other"
assert(not ns.IsPlayerOfficer(), "Other guilds must not inherit website authorization")
guild, realm = "Guild", "OtherRealm"
assert(not ns.IsPlayerOfficer(), "An identically named guild on another realm must not inherit authorization")
realm, guild = "Realm", nil
assert(not ns.IsPlayerOfficer(), "Guildless alts must not collect")
guild = "Guild"
FlockSyncHelperDB.isAuthorizedOfficer = false
assert(not ns.IsPlayerOfficer(), "Explicitly unauthorized helper must not grant collection")
FlockSyncHelperDB.isAuthorizedOfficer = true
FlockSyncHelperDB.authorizedCollectorGuild = nil
assert(not ns.IsPlayerOfficer(), "A replacement helper without a grant must remove website-only collection")
native = true
assert(ns.IsPlayerOfficer(), "Native officer permissions must still work")
native = false
assert(ns.IsPlayerOfficer(), "Previously established same-guild native officer status must still work")
guild = "Other"
assert(not ns.IsPlayerOfficer(), "Native account officer cache must remain guild-scoped")
FlockSyncDB.config.forceOfficerMode = true
assert(ns.GetOfficerStatusReason() == "Dev Override")
print("Website-authorized account collectors, guild/realm scope and native permissions: passed")
