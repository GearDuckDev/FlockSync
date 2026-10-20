local addonName, ns = ...

-- Read-only guild snapshot (crafters, raids, goals) delivered by the desktop app
-- to officers, or relayed by an officer over guild comms to everyone else.
ns.Snapshot = {
    craftersByItem = {},
    goalsByItem = {},
    upcomingRaids = {},
    craftersIndex = {},
    serverTimestamp = 0,
    origin = nil,
}

local listeners = {}
local currentSource = nil

function ns.OnSnapshotChanged(callback)
    listeners[#listeners + 1] = callback
end

local function isText(value)
    return type(value) == "string" and value ~= ""
end

local function validCrafter(entry)
    return type(entry) == "table" and type(entry.itemIdOrSpellId) == "number"
        and isText(entry.characterGuid) and isText(entry.characterName)
end

local function validNeed(entry)
    return type(entry) == "table" and isText(entry.characterGuid)
        and isText(entry.characterName)
end

local function validRaid(raid)
    return type(raid) == "table" and isText(raid.id) and isText(raid.name)
        and type(raid.assignments) == "table"
end

local function rebuild(source, origin)
    ns.CacheAddonReleases(source.addonReleases)
    local snapshot = ns.Snapshot
    snapshot.craftersByItem = {}
    snapshot.goalsByItem = {}
    snapshot.upcomingRaids = {}
    snapshot.craftersIndex = {}
    snapshot.serverTimestamp = source.serverTimestamp or 0
    snapshot.origin = origin

    for _, entry in ipairs(type(source.craftersIndex) == "table" and source.craftersIndex or {}) do
        if validCrafter(entry) then
            local id = entry.itemIdOrSpellId
            local list = snapshot.craftersByItem[id] or {}
            list[#list + 1] = entry
            snapshot.craftersByItem[id] = list
            snapshot.craftersIndex[#snapshot.craftersIndex + 1] = entry
        end
    end
    for _, match in ipairs(type(source.goalMatches) == "table" and source.goalMatches or {}) do
        if type(match) == "table" and type(match.itemId) == "number"
            and type(match.neededBy) == "table" then
            local needs = {}
            for _, entry in ipairs(match.neededBy) do
                if validNeed(entry) then
                    needs[#needs + 1] = entry
                end
            end
            if #needs > 0 then
                snapshot.goalsByItem[match.itemId] = needs
            end
        end
    end
    for _, raid in ipairs(type(source.upcomingRaids) == "table" and source.upcomingRaids or {}) do
        if validRaid(raid) then
            snapshot.upcomingRaids[#snapshot.upcomingRaids + 1] = raid
        end
    end
    currentSource = source
    for _, callback in ipairs(listeners) do
        pcall(callback)
    end
end

local function timestampOf(source)
    return type(source) == "table" and type(source.serverTimestamp) == "number"
        and source.serverTimestamp or 0
end

-- The desktop-written helper file only counts on a PC linked to the desktop app.
local function helperSource()
    local helper = FlockSyncHelperDB
    if type(helper) == "table" and helper.isAuthorizedOfficer == true
        and timestampOf(helper) > 0 then
        return helper
    end
    return nil
end

-- Called on PLAYER_LOGIN: uses whichever of the helper file or the cached guild
-- broadcast is newer.
function ns.LoadSnapshot()
    local helper = helperSource()
    local cached = type(FlockSyncDB.guildSnapshot) == "table" and FlockSyncDB.guildSnapshot or nil
    if helper and timestampOf(helper) >= timestampOf(cached) then
        rebuild(helper, "helper")
    elseif cached and timestampOf(cached) > 0 then
        rebuild(cached, "broadcast")
    end
end

-- Stores a snapshot relayed by a guild officer when it is newer than ours.
-- Far-future timestamps are rejected so a bad sender cannot block real updates.
-- The guild name is kept so alts in another guild ignore the cached copy.
function ns.ApplyBroadcastSnapshot(source, guildName)
    local stamp = timestampOf(source)
    if stamp <= ns.Snapshot.serverTimestamp or stamp > GetServerTime() + 300 then
        return false
    end
    source.guild = guildName
    FlockSyncDB.guildSnapshot = source
    rebuild(source, "broadcast")
    return true
end

-- FlockSyncDB is account-wide, so a cached broadcast may belong to another
-- character's guild; hide it (without deleting it) once our guild is known.
function ns.EnforceSnapshotGuild(guildName)
    if ns.Snapshot.origin ~= "broadcast" or not currentSource
        or currentSource.guild == guildName then
        return
    end
    rebuild({ serverTimestamp = 0 }, nil)
    currentSource = nil
end

function ns.GetSnapshotSource()
    return currentSource
end

function ns.HasSnapshot()
    return ns.Snapshot.serverTimestamp > 0
end

function ns.DescribeSnapshot()
    if not ns.HasSnapshot() then
        return "No guild snapshot yet. Officers: sync with the desktop app. Members: an officer shares it when online."
    end
    local origin = ns.Snapshot.origin == "helper" and "desktop sync" or "guild officer"
    return "Guild snapshot from " .. origin .. ", "
        .. date("%Y-%m-%d %H:%M", ns.Snapshot.serverTimestamp)
end
