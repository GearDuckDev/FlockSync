local addonName, ns = ...

-- A realm is the numeric server id inside every player GUID
-- ("Player-6930-0ABC" -> "6930"). Forever clients return "" from
-- GetRealmName(), so realm names are never used as identity.
function ns.GuidServerId(guid)
    local id = type(guid) == "string" and guid:match("^Player%-(%d+)%-") or nil
    return id and #id <= 10 and id or nil
end

function ns.GetPlayerRealm()
    return ns.GuidServerId(UnitGUID and UnitGUID("player"))
end

function ns.IsServerRealm(value)
    return type(value) == "string" and #value <= 10 and value:match("^%d+$") ~= nil
end

-- Guilds are identified by name only: a connected realm (one guild, many
-- server ids) is still one guild, and a guild name is unique per realm group.
function ns.IsOwnGuild(guild)
    local name = ns.CurrentGuildName and ns.CurrentGuildName()
    return name ~= nil and type(guild) == "table" and guild.name == name
end

-- Pre-1.2 helper files and caches still carry realm names; they resolve
-- through labels learned by the one-time SavedVariables migration.
function ns.NormalizeRealm(value)
    if ns.IsServerRealm(value) then return value end
    local labels = type(FlockSyncDB) == "table" and FlockSyncDB.legacyRealmLabels
    return type(labels) == "table" and type(value) == "string" and labels[value] or nil
end
