local addonName, ns = ...

-- Forever clients return "" from GetRealmName(); the numeric server id inside
-- every player GUID still identifies the server. Values must exactly match the
-- realm already stored by the API (captured while the native API worked).
ns.KNOWN_SERVER_REALMS = {
    ["6932"] = "CAMWOW US2 Realm 6 PvP",
}

local function nonEmpty(value)
    return type(value) == "string" and value ~= "" and value or nil
end

local function nativeRealm()
    return nonEmpty(GetRealmName())
end

function ns.GuidServerId(guid)
    return type(guid) == "string" and guid:match("^Player%-(%d+)%-") or nil
end

local function playerServerId()
    return ns.GuidServerId(UnitGUID and UnitGUID("player"))
end

-- Learns from this account's own earlier captures; refuses to guess when
-- records with the same server id disagree.
local function learnedRealm(serverId)
    if type(FlockSyncDB) ~= "table" then return nil end
    local found
    for _, name in ipairs({ "accountCharacters", "characters" }) do
        for key, character in pairs(type(FlockSyncDB[name]) == "table" and FlockSyncDB[name] or {}) do
            local realm = type(character) == "table" and nonEmpty(character.realm)
            if realm and ns.GuidServerId(character.guid or key) == serverId then
                if found and found ~= realm then return nil end
                found = realm
            end
        end
    end
    return found
end

function ns.DetectServerRealm()
    local serverId = playerServerId()
    if not serverId then return nil end
    return ns.KNOWN_SERVER_REALMS[serverId] or learnedRealm(serverId)
end

function ns.GetPlayerRealm()
    local realm = nativeRealm()
    if realm then return realm end
    local config = type(FlockSyncDB) == "table" and FlockSyncDB.config
    realm = type(config) == "table" and nonEmpty(config.realmIdentity)
    if realm then return realm end
    return ns.DetectServerRealm()
end

function ns.SetRealmIdentity(value)
    if type(value) ~= "string" then return false, "Usage: /fs realm <exact server realm>" end
    value = value:match("^%s*(.-)%s*$")
    local length = ns.KillTextLength(value)
    if not length or length < 1 or length > 80 or value:find("[%c|]") then
        return false, "Enter the exact server realm (1-80 characters, no links or controls)."
    end
    local config = FlockSyncDB.config
    if type(config.realmIdentity) == "string" and config.realmIdentity ~= value then
        return false, "Realm already configured. Do not change it without a data migration."
    end
    local native = GetRealmName()
    if type(native) == "string" and native ~= "" then
        return false, "The client reports a realm; its native identity is used."
    end
    config.realmIdentity = value
    return true
end

function ns.GetCharacterRealmFallback(guid)
    local realm = ns.GetPlayerRealm()
    if not realm then return end
    local manual = type(FlockSyncDB.config) == "table" and FlockSyncDB.config.realmIdentity == realm
    local serverId = playerServerId()
    if manual or (serverId and ns.GuidServerId(guid) == serverId) then return realm end
end

function ns.RepairMissingRulesetRealms()
    if type(FlockSyncDB) ~= "table" then return end
    if nativeRealm() then return end
    local repaired = 0
    local realm
    for _, name in ipairs({ "characters", "accountCharacters" }) do
        for key, character in pairs(type(FlockSyncDB[name]) == "table" and FlockSyncDB[name] or {}) do
            if type(character) == "table" and character.realm == "" then
                local fallback = ns.GetCharacterRealmFallback(character.guid or key)
                if fallback then
                    character.realm = fallback
                    realm = fallback
                    repaired = repaired + 1
                end
            end
        end
    end
    if repaired > 0 then
        print("FlockSync: Repaired " .. repaired .. " empty character realm values using " .. realm
            .. ". Log out, let Desktop sync finish, then log in to load server data.")
    end
end
