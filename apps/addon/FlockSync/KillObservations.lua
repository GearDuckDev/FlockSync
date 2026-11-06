local addonName, ns = ...

local RETENTION, LIMIT = 90 * 86400, 5000
local function keyOf(entry)
    return entry.realm:lower() .. "\031" .. entry.name:lower()
end
function ns.KillObservationStore(destination)
    local state = ns.GetKillState()
    if not state then return nil end
    if destination == "personal" then
        state.observations = state.observations or {}
        return state.observations
    end
    local guild = ns.KillGuildKey()
    if not guild then return nil end
    if destination == "local" then
        state.localGuildObservations = state.localGuildObservations or {}
        state.localGuildObservations[guild] = state.localGuildObservations[guild] or {}
        return state.localGuildObservations[guild]
    end
    FlockSyncDB.killListObservationsGuilds = FlockSyncDB.killListObservationsGuilds or {}
    FlockSyncDB.killListObservationsGuilds[guild] = FlockSyncDB.killListObservationsGuilds[guild] or {}
    return FlockSyncDB.killListObservationsGuilds[guild]
end

function ns.ValidateKillObservation(entry)
    if type(entry) ~= "table" then return false end
    for _, key in ipairs({ "id", "kind", "name", "realm", "targetGuid", "zone", "reporterGuid", "reporter" }) do
        local value = entry[key]
        if type(value) ~= "string" or #value < 1 or #value > (key == "id" and 240 or 320)
            or value:find("[%c|]") then return false end
    end
    local now = GetServerTime()
    if type(entry.timestamp) ~= "number" or entry.timestamp % 1 ~= 0
        or entry.timestamp > now + 30 or (entry.kind ~= "SIGHTING" and entry.timestamp < now - RETENTION)
        or type(entry.targetCreatedAt) ~= "number" or entry.targetCreatedAt % 1 ~= 0
        or entry.targetCreatedAt < 0 or entry.targetCreatedAt > entry.timestamp
        or not ns.ValidateKillTarget(entry.name, entry.realm, "") then return false end
    if entry.kind == "SIGHTING" then
        return entry.actorGuid == nil and entry.actor == nil and entry.victimGuid == nil and entry.victim == nil
    end
    if entry.kind ~= "KILL" and entry.kind ~= "DEATH" then return false end
    for _, key in ipairs({ "actorGuid", "actor", "victimGuid", "victim" }) do
        if type(entry[key]) ~= "string" or #entry[key] < 1 or #entry[key] > 320
            or entry[key]:find("[%c|]") then return false end
    end
    return (entry.kind == "KILL" and entry.victimGuid == entry.targetGuid)
        or (entry.kind == "DEATH" and entry.actorGuid == entry.targetGuid)
end

function ns.PruneKillObservations(destination)
    local store = ns.KillObservationStore(destination)
    local targets = ns.KillStore(destination == "local" and "shared" or destination)
    if not store or not targets then return end
    local battles = {}
    for id, entry in pairs(store) do
        local valid = ns.ValidateKillObservation(entry)
        local target = valid and targets[keyOf(entry)]
        if not valid or not target or target.deleted
            or target.createdAt ~= entry.targetCreatedAt
            or (destination ~= "personal" and not target.sharedLive) then store[id] = nil
        elseif entry.kind ~= "SIGHTING" then battles[#battles + 1] = entry end
    end
    table.sort(battles, function(a, b)
        return a.timestamp == b.timestamp and a.id < b.id or a.timestamp > b.timestamp
    end)
    for index = LIMIT + 1, #battles do store[battles[index].id] = nil end
end

function ns.MergeKillObservation(entry, destination, recovered, batch)
    if not ns.ValidateKillObservation(entry) then return false end
    if destination == "shared" and (entry.realm ~= GetRealmName()
        or (not recovered and entry.timestamp <= (FlockSyncDB.databaseResetAt or 0))) then return false end
    local targets = ns.KillStore(destination == "local" and "shared" or destination)
    local store = ns.KillObservationStore(destination)
    local target = targets and targets[keyOf(entry)]
    if not store or not target or target.deleted or target.createdAt ~= entry.targetCreatedAt
        or (destination ~= "personal" and not target.sharedLive) then return false end
    local id = entry.kind == "SIGHTING" and ("S:" .. keyOf(entry)) or entry.id
    local old = store[id]
    if old and (entry.kind ~= "SIGHTING" or old.timestamp >= entry.timestamp) then return false end
    if entry.kind ~= "SIGHTING" then
        for _, other in pairs(store) do
            if other.kind == entry.kind and other.targetGuid == entry.targetGuid
                and other.actorGuid == entry.actorGuid and other.victimGuid == entry.victimGuid
                and math.abs(other.timestamp - entry.timestamp) <= 5 then return false end
        end
    end
    local copy = {}
    for _, key in ipairs({ "id", "kind", "name", "realm", "targetGuid", "targetCreatedAt",
        "timestamp", "zone", "reporterGuid", "reporter", "actorGuid", "actor", "victimGuid", "victim" }) do
        copy[key] = entry[key]
    end
    store[id] = copy
    if not batch then
        ns.PruneKillObservations(destination)
        ns.KillListChanged()
    end
    return true
end

function ns.KillObservationRows(item, history)
    local rows, ids = {}, {}
    local destinations = item.destination == "shared" and { "shared", "local" } or { "personal" }
    for _, destination in ipairs(destinations) do
        ns.PruneKillObservations(destination)
        for _, entry in pairs(ns.KillObservationStore(destination) or {}) do
            if (not history or not ids[entry.id]) and keyOf(entry) == item.key and entry.targetCreatedAt == item.entry.createdAt
                and ((history and entry.kind ~= "SIGHTING") or (not history and entry.kind == "SIGHTING")) then
                ids[entry.id] = true
                rows[#rows + 1] = entry
            end
        end
    end
    table.sort(rows, function(a, b)
        return a.timestamp == b.timestamp and a.id < b.id or a.timestamp > b.timestamp
    end)
    if not history then return rows[1] and { rows[1] } or {} end
    return rows
end
