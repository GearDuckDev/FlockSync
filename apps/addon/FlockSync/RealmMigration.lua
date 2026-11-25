local addonName, ns = ...

-- One-time SavedVariables migration from realm names to GUID server ids.
-- Version 2 keys guild stores by guild name only (connected realms).
local VERSION = 2

-- A label maps to a server id only when every known character with it agrees;
-- a connected-realm label stays a label and matches kill targets by name.
local function learnLabels(db)
    local labels = {}
    for _, name in ipairs({ "accountCharacters", "characters" }) do
        for key, character in pairs(type(db[name]) == "table" and db[name] or {}) do
            local realm = type(character) == "table" and character.realm
            local server = type(character) == "table" and ns.GuidServerId(character.guid or key)
            if server and type(realm) == "string" and realm ~= "" and not ns.IsServerRealm(realm) then
                local known = labels[realm]
                labels[realm] = (known == nil or known == server) and server or false
            end
        end
    end
    local result = {}
    for label, server in pairs(labels) do
        if server then result[label] = server end
    end
    return result
end

local function normalized(realm)
    return ns.NormalizeRealm(realm) or realm
end

local function keep(out, key, value, stamp)
    local old = out[key]
    if type(old) ~= "table" or type(value) ~= "table" or (value[stamp] or 0) > (old[stamp] or 0) then
        out[key] = value
    end
end

local function rekeyTargets(store)
    local out = {}
    for key, entry in pairs(store) do
        if type(entry) == "table" and type(entry.realm) == "string" and type(entry.name) == "string" then
            entry.realm = normalized(entry.realm)
            key = entry.realm:lower() .. "\031" .. entry.name:lower()
        end
        keep(out, key, entry, "updatedAt")
    end
    return out
end

local function rekeyObservations(store)
    local out = {}
    for id, entry in pairs(store) do
        if type(entry) == "table" and type(entry.realm) == "string" and type(entry.name) == "string" then
            entry.realm = normalized(entry.realm)
            if entry.kind == "SIGHTING" then id = "S:" .. entry.realm:lower() .. "\031" .. entry.name:lower() end
        end
        keep(out, id, entry, "timestamp")
    end
    return out
end

local function rekeyGuilds(map, rekeyInner, stamp)
    local out = {}
    for key, store in pairs(map) do
        local guild
        if type(key) == "string" then guild = key:match("^.-\031(.*)$") end
        local newKey = guild or key
        if type(store) == "table" then
            store = rekeyInner(store)
            if type(out[newKey]) == "table" then
                for inner, value in pairs(store) do keep(out[newKey], inner, value, stamp) end
                store = out[newKey]
            end
        end
        out[newKey] = store
    end
    return out
end

local function migrateCharacters(db)
    for _, name in ipairs({ "accountCharacters", "characters" }) do
        for key, character in pairs(type(db[name]) == "table" and db[name] or {}) do
            local server = type(character) == "table" and ns.GuidServerId(character.guid or key)
            if server then character.realm = server end
        end
    end
end

local function migrateKillLists(db)
    if type(db.killListGuilds) == "table" then
        db.killListGuilds = rekeyGuilds(db.killListGuilds, rekeyTargets, "updatedAt")
    end
    if type(db.killListObservationsGuilds) == "table" then
        db.killListObservationsGuilds = rekeyGuilds(db.killListObservationsGuilds, rekeyObservations, "timestamp")
    end
    for _, state in pairs(type(db.killListCharacters) == "table" and db.killListCharacters or {}) do
        if type(state) == "table" then
            if type(state.entries) == "table" then state.entries = rekeyTargets(state.entries) end
            if type(state.observations) == "table" then state.observations = rekeyObservations(state.observations) end
            if type(state.localGuildObservations) == "table" then
                state.localGuildObservations = rekeyGuilds(state.localGuildObservations, rekeyObservations, "timestamp")
            end
        end
    end
end

-- Idempotent; safe to rerun over version 1 data.
function ns.MigrateRealmIdentity()
    local db = FlockSyncDB
    if type(db) ~= "table" or (tonumber(db.realmIdentityVersion) or 0) >= VERSION then return end
    local labels = learnLabels(db)
    local previous = type(db.legacyRealmLabels) == "table" and db.legacyRealmLabels or {}
    for label, server in pairs(labels) do previous[label] = previous[label] or server end
    db.legacyRealmLabels = previous
    migrateCharacters(db)
    migrateKillLists(db)
    local label = type(db.officerCharacter) == "string" and db.officerCharacter:match("^.* %((.-)%)$")
    local server = label and ns.NormalizeRealm(label)
    if server and server ~= label then
        db.officerCharacter = db.officerCharacter:sub(1, #db.officerCharacter - #label - 1) .. server .. ")"
    end
    if type(db.config) == "table" then db.config.realmIdentity = nil end
    db.realmIdentityVersion = VERSION
end
