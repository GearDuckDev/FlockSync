local addonName, ns = ...

local ranks = { alpha = 0, beta = 1, release = 2 }

local function parseVersion(version)
    if type(version) ~= "string" or #version > 64 then
        return nil
    end
    local major, minor, patch, suffix = version:match("^(%d+)%.(%d+)%.(%d+)(.*)$")
    if not major then return nil end
    for _, part in ipairs({ major, minor, patch }) do
        if #part > 1 and part:sub(1, 1) == "0" then return nil end
    end
    local channel, sequence = "release", -1
    if suffix ~= "" then
        local label = suffix:match("^%-(%a+)$")
        local number
        if not label then
            label, number = suffix:match("^%-(%a+)%.(%d+)$")
        end
        if label ~= "alpha" and label ~= "beta" then return nil end
        if number and #number > 1 and number:sub(1, 1) == "0" then return nil end
        channel, sequence = label, number and tonumber(number) or -1
    end
    return { tonumber(major), tonumber(minor), tonumber(patch), ranks[channel], sequence }, channel
end

local function newer(left, right)
    local a, b = parseVersion(left), parseVersion(right)
    if not a or not b then return false end
    for i = 1, 5 do
        if a[i] ~= b[i] then return a[i] > b[i] end
    end
    return false
end

-- Metadata received during play is only cached; notification happens on login.
function ns.CacheAddonReleases(catalog)
    if type(catalog) ~= "table" then return end
    if type(FlockSyncDB.addonReleases) ~= "table" then
        FlockSyncDB.addonReleases = {}
    end
    for channel in pairs(ranks) do
        local entry = catalog[channel]
        local version = type(entry) == "table" and entry.version or nil
        local _, actualChannel = parseVersion(version)
        local existing = FlockSyncDB.addonReleases[channel]
        local _, existingChannel = parseVersion(existing)
        if actualChannel == channel and (existingChannel ~= channel or newer(version, existing)) then
            FlockSyncDB.addonReleases[channel] = version
        end
    end
end

function ns.CompactAddonReleases()
    local compact = {}
    for channel, version in pairs(type(FlockSyncDB.addonReleases) == "table"
        and FlockSyncDB.addonReleases or {}) do
        local _, actualChannel = parseVersion(version)
        if ranks[channel] and actualChannel == channel then
            compact[channel] = { version = version }
        end
    end
    return compact
end

local function latestUpdate(installed, catalog)
    local _, installedChannel = parseVersion(installed)
    if not installedChannel then return end
    local latest
    for channel, entry in pairs(type(catalog) == "table" and catalog or {}) do
        local version = type(entry) == "table" and entry.version or nil
        local _, actualChannel = parseVersion(version)
        if ranks[channel] and actualChannel == channel and ranks[channel] >= ranks[installedChannel]
            and newer(version, installed)
            and (not latest or newer(entry.version, latest)) then
            latest = version
        end
    end
    return latest
end

local checkedThisLogin = false
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function(_, _, isInitialLogin)
    if not isInitialLogin or checkedThisLogin then return end
    checkedThisLogin = true
    local installed = ns.GetAddonVersion()
    local latest = latestUpdate(installed, ns.CompactAddonReleases())
    if latest then
        print("|cff33ccffFlockSync:|r v" .. latest
            .. " is available (installed: v" .. installed
            .. "). Update through CurseForge; select Alpha or Beta there for preview builds.")
    end
    -- Only a loaded helper identifies an officer-component installation.
    if type(FlockSyncHelperDB) ~= "table" then return end
    local metadata = C_AddOns and C_AddOns.GetAddOnMetadata or GetAddOnMetadata
    local helperVersion = metadata and metadata("FlockSync_AppHelper", "Version")
    local helperLatest = latestUpdate(helperVersion, FlockSyncHelperDB.helperReleases)
    if helperLatest then
        print("|cff33ccffFlockSync AppHelper:|r v" .. helperLatest
            .. " is available (installed: v" .. helperVersion
            .. "). Download the officer bundle from the FlockSync GitHub: github.com/GearDuckDev/FlockSync/releases")
    end
end)
