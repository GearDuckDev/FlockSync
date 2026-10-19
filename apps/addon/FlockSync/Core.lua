local addonName, ns = ...

-- UnitName() drops the second name part on this client; GetUnitName(unit, true)
-- keeps it. Only the mega-realm suffix is stripped.
function ns.GetPlayerFullName()
    local full = GetUnitName and GetUnitName("player", true) or nil
    if not full or full == "" then
        return UnitName("player")
    end
    local realm = GetNormalizedRealmName and GetNormalizedRealmName() or nil
    if realm and realm ~= "" then
        local suffix = "-" .. realm
        if #full > #suffix and full:sub(-#suffix) == suffix then
            full = full:sub(1, #full - #suffix)
        end
    end
    return full
end

function ns.RegisterAccountCharacter()
    local guid = UnitGUID("player")
    local name = ns.GetPlayerFullName()
    local realm = GetRealmName()
    local _, _, classId = UnitClass("player")
    if not guid or not name or not realm or not classId then
        return
    end
    FlockSyncDB.accountCharacters[guid] = {
        guid = guid,
        name = name,
        realm = realm,
        classId = classId,
        level = UnitLevel("player"),
    }
end

-- Forgets a character the user deleted in the client: registry, profile and
-- any locally aggregated record. Never removes the logged-in character.
function ns.RemoveAccountCharacter(guid)
    if type(guid) ~= "string" or guid == UnitGUID("player") then
        return false
    end
    FlockSyncDB.accountCharacters[guid] = nil
    FlockSyncDB.profiles[guid] = nil
    FlockSyncDB.characters[guid] = nil
    for _, profile in pairs(FlockSyncDB.profiles) do
        if profile.mainCharacterGuid == guid then
            profile.mainCharacterGuid = nil
            profile.mainCharacterName = nil
        end
    end
    local mine = FlockSyncDB.characters[UnitGUID("player")]
    if mine and mine.mainCharacterGuid == guid then
        mine.mainCharacterGuid = nil
        mine.mainCharacterName = nil
    end
    return true
end

-- Names may contain spaces; the realm is a single mega-realm (PvP/PvE/RP).
function ns.FormatCharacterLabel(name, realm)
    return name .. " (" .. realm .. ")"
end

function ns.GetOfficerStatusReason()
    local config = FlockSyncDB and FlockSyncDB.config or {}
    if ns.debugOfficerOverride == true then
        return "Debug Override (Session)"
    end
    if config.forceOfficerMode == true then
        return "Dev Override"
    end
    if type(FlockSyncHelperDB) == "table"
        and FlockSyncHelperDB.isAuthorizedOfficer == true then
        return "Desktop App Linked"
    end
    if C_GuildInfo and C_GuildInfo.CanViewOfficerNote
        and C_GuildInfo.CanViewOfficerNote() == true then
        return "Guild Officer Permission"
    end
    if not IsInGuild() then
        return nil
    end
    local _, _, rankIndex = GetGuildInfo("player")
    if type(rankIndex) == "number"
        and rankIndex <= (config.officerRankThreshold or 2) then
        return "Guild Rank"
    end
    return nil
end

function ns.IsPlayerOfficer()
    return ns.GetOfficerStatusReason() ~= nil
end

function ns.MergeCharacter(incoming)
    if type(incoming) ~= "table" or type(incoming.guid) ~= "string" then
        return
    end
    local existing = FlockSyncDB.characters[incoming.guid]
    if not existing then
        FlockSyncDB.characters[incoming.guid] = incoming
        return
    end

    local role = incoming.role
    local existingRole = type(existing.role) == "table" and existing.role or {}
    if type(role) == "table" and type(role.updatedAt) == "number"
        and role.updatedAt > (existingRole.updatedAt or 0) then
        existing.role = role
    end
    local gear = incoming.gear
    local existingGear = type(existing.gear) == "table" and existing.gear or {}
    if type(gear) == "table" and type(gear.updatedAt) == "number"
        and gear.updatedAt > (existingGear.updatedAt or 0) then
        existing.gear = gear
    end
    if type(incoming.availability) == "table"
        and type(incoming.availability.updatedAt) == "number"
        and incoming.availability.updatedAt
            > ((existing.availability or {}).updatedAt or 0) then
        existing.availability = incoming.availability
    end
    if type(incoming.lockouts) == "table"
        and type(incoming.lockouts.updatedAt) == "number"
        and incoming.lockouts.updatedAt
            > ((existing.lockouts or {}).updatedAt or 0) then
        existing.lockouts = incoming.lockouts
    end
    for _, key in ipairs({ "professions", "gearGoals" }) do
        local value = incoming[key]
        if type(value) == "table" and type(value.updatedAt) == "number"
            and value.updatedAt > ((existing[key] or {}).updatedAt or 0) then
            existing[key] = value
        end
    end
    if ns.AttunementsEpoch(incoming.attunements) > ns.AttunementsEpoch(existing.attunements) then
        existing.attunements = incoming.attunements
    end
    if type(incoming.lastSeenAt) == "number"
        and incoming.lastSeenAt >= (existing.lastSeenAt or 0) then
        ns.ReviveStaleCharacter(existing, incoming)
        existing.name = incoming.name
        existing.realm = incoming.realm
        existing.classId = incoming.classId
        existing.level = incoming.level
        existing.mainCharacterGuid = incoming.mainCharacterGuid
        existing.mainCharacterName = incoming.mainCharacterName
        existing.lastSeenAt = incoming.lastSeenAt
        if existing.isActive ~= false then
            existing.isActive = incoming.isActive ~= false
        end
    end
end

local function ingestHelperPayload()
    if type(FlockSyncHelperDB) ~= "table" then
        return
    end
    local culled = FlockSyncHelperDB.culledCharacterGuids
    if type(culled) == "table" then
        for _, guid in ipairs(culled) do
            local character = type(guid) == "string"
                and FlockSyncDB.characters[guid] or nil
            if character then
                character.isActive = false
                -- A manual web cull is sticky; it is no longer an auto-stale.
                FlockSyncDB.staleCharacters[guid] = nil
            end
        end
    end
    if type(FlockSyncHelperDB.serverTimestamp) == "number" then
        FlockSyncDB.exportedAt = FlockSyncHelperDB.serverTimestamp
    end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function(_, event, loadedAddon)
    if event == "ADDON_LOADED" and loadedAddon == addonName then
        ns.InitializeDatabase()
    elseif event == "PLAYER_LOGIN" then
        ingestHelperPayload()
        ns.LoadSnapshot()
    end
end)
