local addonName, ns = ...

local function currentGuildName()
    if not IsInGuild() then
        return nil
    end
    local name = GetGuildInfo("player")
    if type(name) == "string" and name ~= "" then
        return name
    end
    return nil
end

local function guildRankIsOfficer()
    if not IsInGuild() then
        return false
    end
    local _, _, rankIndex = GetGuildInfo("player")
    local config = FlockSyncDB and FlockSyncDB.config or {}
    return type(rankIndex) == "number"
        and rankIndex <= (config.officerRankThreshold or 2)
end

local function nativeOfficerPermission()
    return C_GuildInfo and C_GuildInfo.CanViewOfficerNote
        and C_GuildInfo.CanViewOfficerNote() == true
end

local function authorizeCurrentGuild(guildName)
    if not guildName or type(FlockSyncDB) ~= "table" then
        return
    end
    if type(FlockSyncDB.officerGuilds) ~= "table" then
        FlockSyncDB.officerGuilds = {}
    end
    FlockSyncDB.officerGuilds[guildName] = true
end

function ns.GetOfficerStatusReason()
    local config = FlockSyncDB and FlockSyncDB.config or {}
    if ns.debugOfficerOverride == true then
        return "Debug Override (Session)"
    end
    if config.forceOfficerMode == true then
        return "Dev Override"
    end

    local guildName = currentGuildName()
    if guildName and nativeOfficerPermission() then
        authorizeCurrentGuild(guildName)
        return "Guild Officer Permission"
    end
    if guildRankIsOfficer() then
        authorizeCurrentGuild(guildName)
        return "Guild Rank"
    end

    local helper = FlockSyncHelperDB
    local collectorGuild = type(helper) == "table" and helper.authorizedCollectorGuild
    if guildName and type(helper) == "table" and helper.isAuthorizedOfficer == true
        and type(collectorGuild) == "table" and collectorGuild.name == guildName
        and collectorGuild.realm == GetRealmName() then
        return "Website Officer/Admin (Same Guild)"
    end

    if guildName and type(FlockSyncDB) == "table"
        and type(FlockSyncDB.officerGuilds) == "table"
        and FlockSyncDB.officerGuilds[guildName] == true then
        if type(FlockSyncHelperDB) == "table"
            and FlockSyncHelperDB.isAuthorizedOfficer == true then
            return "Desktop App Linked (Same Guild)"
        end
        return "Account Officer (Same Guild)"
    end
    return nil
end

function ns.IsPlayerOfficer()
    return ns.GetOfficerStatusReason() ~= nil
end
