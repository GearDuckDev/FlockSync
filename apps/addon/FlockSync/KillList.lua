local addonName, ns = ...

local listeners = {}
function ns.OnKillListChanged(callback) listeners[#listeners + 1] = callback end
function ns.KillListChanged()
    for _, callback in ipairs(listeners) do callback() end
end

function ns.GetKillState()
    local guid = UnitGUID("player")
    if not guid or type(FlockSyncDB) ~= "table" then return nil end
    FlockSyncDB.killListCharacters = FlockSyncDB.killListCharacters or {}
    local state = FlockSyncDB.killListCharacters[guid] or { enabled = false, personalEnabled = true, entries = {} }
    FlockSyncDB.killListCharacters[guid] = state
    for key, value in pairs({ popupEnabled = true, soundEnabled = true, skullEnabled = false,
        historyEnabled = true, reportEnabled = true }) do
        if state[key] == nil then state[key] = value end
    end
    return state
end

function ns.KillListEnabled()
    local state = ns.GetKillState()
    return state ~= nil and state.enabled == true
end

function ns.SetKillSetting(key, value)
    local state = ns.GetKillState()
    local allowed = { enabled = true, personalEnabled = true, popupEnabled = true,
        soundEnabled = true, skullEnabled = true, historyEnabled = true, reportEnabled = true }
    if not state or not allowed[key] or type(value) ~= "boolean" then
        print("FlockSync: Kill-list character or setting unavailable.")
        return false
    end
    state[key] = value
    ns.KillListChanged()
    return true
end

function ns.KillGuildKey()
    local guild = ns.CurrentGuildName()
    return guild and (GetRealmName() .. "\031" .. guild) or nil
end

function ns.KillStore(destination)
    local state = ns.GetKillState()
    if not state then return nil end
    if destination == "personal" then return state.entries end
    if destination ~= "shared" then return nil end
    local key = ns.KillGuildKey()
    if not key then return nil end
    FlockSyncDB.killListGuilds = FlockSyncDB.killListGuilds or {}
    FlockSyncDB.killListGuilds[key] = FlockSyncDB.killListGuilds[key] or {}
    return FlockSyncDB.killListGuilds[key]
end

function ns.KillOfficer()
    if not ns.CurrentGuildName() then return false end
    local _, _, rank = GetGuildInfo("player")
    if type(rank) == "number" and rank <= (FlockSyncDB.config.officerRankThreshold or 2) then return true end
    if C_GuildInfo and C_GuildInfo.CanViewOfficerNote and C_GuildInfo.CanViewOfficerNote() == true then return true end
    local helper = FlockSyncHelperDB
    local guild = type(helper) == "table" and helper.authorizedCollectorGuild
    return type(helper) == "table" and helper.isAuthorizedOfficer == true and type(guild) == "table"
        and guild.name == ns.CurrentGuildName() and guild.realm == GetRealmName()
end

function ns.CanChangeKill(item, removing)
    if item.destination == "shared" and item.entry.sharedLive then
        return ns.KillLiveMember() ~= nil
    end
    return item.destination == "personal" or ns.KillOfficer()
        or (removing and item.entry.authorGuid == UnitGUID("player"))
end

function ns.KillEntries()
    local result, state = {}, ns.GetKillState()
    if not state or not state.enabled then return result end
    for _, destination in ipairs({ "shared", "personal" }) do
        if destination ~= "personal" or state.personalEnabled then
            for key, entry in pairs(ns.KillStore(destination) or {}) do
                if not entry.deleted then result[#result + 1] = { key = key, destination = destination, entry = entry } end
            end
        end
    end
    table.sort(result, function(a, b)
        if a.key == b.key then return a.destination < b.destination end
        return a.key < b.key
    end)
    return result
end
