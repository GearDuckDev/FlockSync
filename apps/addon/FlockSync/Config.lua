local addonName, ns = ...

function ns.GetAddonVersion()
    if C_AddOns and C_AddOns.GetAddOnMetadata then
        return C_AddOns.GetAddOnMetadata(addonName, "Version")
    elseif GetAddOnMetadata then
        return GetAddOnMetadata(addonName, "Version")
    end
end

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
    FlockSyncDB.addonVersion = ns.GetAddonVersion() or "unknown"
    FlockSyncDB.officerCharacter = FlockSyncDB.officerCharacter or ""
    FlockSyncDB.exportedAt = FlockSyncDB.exportedAt or 0
    if type(FlockSyncDB.config) ~= "table" then
        FlockSyncDB.config = {}
    end
    FlockSyncDB.config.officerRankThreshold =
        FlockSyncDB.config.officerRankThreshold or 2
    -- Config v4 disables the development override; officer status is guild-scoped.
    if (FlockSyncDB.config.configVersion or 1) < 4 then
        FlockSyncDB.config.forceOfficerMode = false
        FlockSyncDB.config.configVersion = 4
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
    if type(FlockSyncDB.officerGuilds) ~= "table" then
        FlockSyncDB.officerGuilds = {}
    end
    ns.MigrateRealmIdentity()
end

local function knownCharacter(guid, currentGuid)
    if guid == currentGuid then
        return { guid = guid, name = ns.GetPlayerFullName and ns.GetPlayerFullName() or UnitName("player") }
    end
    local character = FlockSyncDB.accountCharacters[guid]
    return type(character) == "table" and type(character.name) == "string" and character or nil
end

-- Migrates older per-character Main choices to the account-wide value once.
local function migrateAccountMain(currentGuid, currentProfile)
    local selected = currentProfile and currentProfile.mainCharacterGuid
    if selected and knownCharacter(selected, currentGuid) then return selected end
    local counts = {}
    for guid, profile in pairs(FlockSyncDB.profiles) do
        local mainGuid = type(profile) == "table" and (profile.mainCharacterGuid or guid)
        if mainGuid and knownCharacter(mainGuid, currentGuid) then
            counts[mainGuid] = (counts[mainGuid] or 0) + 1
        end
    end
    local best, bestCount = currentGuid, counts[currentGuid] or 0
    for guid, count in pairs(counts) do
        local name, bestName = knownCharacter(guid, currentGuid).name, knownCharacter(best, currentGuid).name
        if count > bestCount or (count == bestCount and best ~= currentGuid and name < bestName) then
            best, bestCount = guid, count
        end
    end
    return best
end

function ns.SetAccountMain(guid)
    local currentGuid = UnitGUID("player")
    local character = guid and knownCharacter(guid, currentGuid)
    if not character then return false end
    FlockSyncDB.accountMain = { guid = character.guid, name = character.name }
    for profileGuid, profile in pairs(FlockSyncDB.profiles) do
        if type(profile) == "table" then
            profile.mainCharacterGuid = profileGuid ~= character.guid and character.guid or nil
            profile.mainCharacterName = profileGuid ~= character.guid and character.name or nil
        end
    end
    return true
end

function ns.GetAccountMain()
    local currentGuid = UnitGUID("player")
    if not currentGuid then return nil end
    local saved = FlockSyncDB.accountMain
    local main = type(saved) == "table" and type(saved.guid) == "string"
        and knownCharacter(saved.guid, currentGuid)
    if not main then
        if not ns.SetAccountMain(migrateAccountMain(currentGuid, FlockSyncDB.profiles[currentGuid])) then
            return nil
        end
        main = knownCharacter(FlockSyncDB.accountMain.guid, currentGuid)
    elseif saved.name ~= main.name then
        ns.SetAccountMain(main.guid)
    end
    local profile = FlockSyncDB.profiles[currentGuid]
    if type(profile) == "table" then
        profile.mainCharacterGuid = currentGuid ~= main.guid and main.guid or nil
        profile.mainCharacterName = currentGuid ~= main.guid and main.name or nil
    end
    return main
end

-- Most settings are per character; Main is account-wide in FlockSyncDB.accountMain.
function ns.GetProfile()
    local guid = UnitGUID("player")
    if not guid then
        return nil
    end
    local hadAccountMain = type(FlockSyncDB.accountMain) == "table"
    local profile = FlockSyncDB.profiles[guid]
    if type(profile) ~= "table" then
        -- Adopt the pre-0.1 single global profile on first login, then drop it.
        profile = type(FlockSyncDB.myProfile) == "table"
            and FlockSyncDB.myProfile or newProfile()
        profile.character = nil
        FlockSyncDB.myProfile = nil
        FlockSyncDB.profiles[guid] = profile
        if not hadAccountMain then profile.mainCharacterGuid, profile.mainCharacterName = nil, nil end
    end
    ns.GetAccountMain()
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
    if profile.acceptingRequests == nil then
        profile.acceptingRequests = true
        -- Existing scanned recipes must publish the new default, not an old epoch.
        if type(profile.professions) == "table" then
            profile.professions.updatedAt = math.max(GetServerTime(), (profile.professions.updatedAt or 0) + 1)
        end
    end
    return profile
end
