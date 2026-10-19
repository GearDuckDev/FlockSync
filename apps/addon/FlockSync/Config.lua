local addonName, ns = ...

local ADDON_VERSION = "0.1.0"
local function newProfile()
    return {
        mainCharacterGuid = nil,
        role = {
            primaryRole = "DPS",
            offSpecEnabled = false,
            offSpecRole = nil,
            updatedAt = 0,
        },
        gear = { updatedAt = 0, items = {} },
    }
end

-- Boolean settings; the feature keys gate the daily-use tabs.
local CONFIG_DEFAULTS = {
    hasCompletedOnboarding = false,
    showMinimap = true,
    showTooltips = true,
    enableSchedule = true,
    enableCrafterSearch = true,
    enableLfgMatcher = true,
}

-- Nothing is scanned or broadcast until the walkthrough has been finished.
function ns.IsOnboarded()
    return type(FlockSyncDB) == "table" and type(FlockSyncDB.config) == "table"
        and FlockSyncDB.config.hasCompletedOnboarding == true
end

function ns.IsEnabled(key)
    return type(FlockSyncDB) == "table" and type(FlockSyncDB.config) == "table"
        and FlockSyncDB.config[key] ~= false
end

function ns.InitializeDatabase()
    if type(FlockSyncDB) ~= "table" then
        FlockSyncDB = {}
    end
    FlockSyncDB.addonVersion = ADDON_VERSION
    FlockSyncDB.officerCharacter = FlockSyncDB.officerCharacter or ""
    FlockSyncDB.exportedAt = FlockSyncDB.exportedAt or 0
    if type(FlockSyncDB.config) ~= "table" then
        FlockSyncDB.config = {}
    end
    FlockSyncDB.config.officerRankThreshold =
        FlockSyncDB.config.officerRankThreshold or 2
    -- Config v2 (production): the development-era officer override is reset
    -- once; officers are detected via the desktop link or guild rank instead.
    if (FlockSyncDB.config.configVersion or 1) < 2 then
        FlockSyncDB.config.forceOfficerMode = false
        FlockSyncDB.config.configVersion = 2
    end
    if FlockSyncDB.config.forceOfficerMode == nil then
        FlockSyncDB.config.forceOfficerMode = false
    end
    -- Carry over a minimap button hidden before showMinimap existed.
    if FlockSyncDB.config.showMinimap == nil and type(FlockSyncDB.minimap) == "table"
        and FlockSyncDB.minimap.hide == true then
        FlockSyncDB.config.showMinimap = false
    end
    for key, default in pairs(CONFIG_DEFAULTS) do
        if type(FlockSyncDB.config[key]) ~= "boolean" then
            FlockSyncDB.config[key] = default
        end
    end
    if type(FlockSyncDB.staleCharacters) ~= "table" then
        FlockSyncDB.staleCharacters = {}
    end
    if type(FlockSyncDB.profiles) ~= "table" then
        FlockSyncDB.profiles = {}
    end
    if type(FlockSyncDB.accountCharacters) ~= "table" then
        FlockSyncDB.accountCharacters = {}
    end
    if type(FlockSyncDB.characters) ~= "table" then
        FlockSyncDB.characters = {}
    end
end

-- A new character defaults to the Main already chosen on another character of
-- this account, so alts don't each need the same selection.
local function inheritMain(profile, guid)
    if profile.mainCharacterGuid then
        return
    end
    for otherGuid, other in pairs(FlockSyncDB.profiles) do
        local mainGuid = type(other) == "table" and other.mainCharacterGuid
        local main = mainGuid and FlockSyncDB.accountCharacters[mainGuid]
        if otherGuid ~= guid and main and mainGuid ~= guid then
            profile.mainCharacterGuid = main.guid
            profile.mainCharacterName = main.name
            return
        end
    end
end

-- Settings are per character because FlockSyncDB is account-wide.
function ns.GetProfile()
    local guid = UnitGUID("player")
    if not guid then
        return nil
    end
    local profile = FlockSyncDB.profiles[guid]
    if type(profile) ~= "table" then
        -- Adopt the pre-0.1 single global profile on first login, then drop it.
        profile = type(FlockSyncDB.myProfile) == "table"
            and FlockSyncDB.myProfile or newProfile()
        profile.character = nil
        FlockSyncDB.myProfile = nil
        FlockSyncDB.profiles[guid] = profile
        inheritMain(profile, guid)
    end
    -- Characters configured before the setup popup existed count as set up.
    if profile.setupDone == nil and type(profile.role) == "table"
        and (profile.role.updatedAt or 0) > 0 then
        profile.setupDone = true
    end
    if type(profile.role) ~= "table" then
        profile.role = newProfile().role
    end
    if type(profile.gear) ~= "table" then
        profile.gear = newProfile().gear
    end
    return profile
end
