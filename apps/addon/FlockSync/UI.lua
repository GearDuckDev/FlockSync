local addonName, ns = ...

-- Daily-use window. Settings live in the Options window (UIOptions.lua).
local PANEL_TOP = -52
local TAB_X, TAB_Y, TAB_GAP = 10, -28, 2
local window

-- Tab name -> config toggle; tabs without a toggle are always shown.
local FEATURE_KEYS = {
    schedule = "enableSchedule",
    crafters = "enableCrafterSearch",
    lfg = "enableLfgMatcher",
}
local TAB_LABELS = {
    schedule = "Raid Schedule",
    crafters = "Crafter Search",
    lfg = "LFG Matcher",
    professions = "Professions & Goals",
}

local function isTabEnabled(name)
    local key = FEATURE_KEYS[name]
    return key == nil or ns.IsEnabled(key)
end

local function applyFeatureToggles()
    if not window then
        return
    end
    for _, tab in ipairs(window.tabs.tabs) do
        window.tabs.SetTabShown(tab.name, isTabEnabled(tab.name))
    end
    window.tabs.LayoutRow(TAB_X, TAB_Y, TAB_GAP)
    if window:IsShown() then
        local selected = window.tabs.Find(window.tabs.selected)
        if not selected or selected.hidden then
            window.tabs.Select(nil)
        end
    end
end

local function createWindow()
    window = ns.CreateWindow("FlockSyncFeaturesFrame", "FlockSync", 450, 444)
    local tabs = ns.CreateTabHost(window, PANEL_TOP)
    tabs.Add("schedule", TAB_LABELS.schedule, 0, TAB_Y, 100, ns.BuildSchedulePanel)
    tabs.Add("crafters", TAB_LABELS.crafters, 0, TAB_Y, 110, ns.BuildCrafterSearchPanel)
    tabs.Add("lfg", TAB_LABELS.lfg, 0, TAB_Y, 95, ns.BuildLfgPanel)
    tabs.Add("professions", TAB_LABELS.professions, 0, TAB_Y, 125, ns.BuildProfessionsPanel)
    window.tabs = tabs

    -- Title bar, beside the close button, so it never covers panel content.
    local options = ns.AddPanelButton(window, "Options", 64, function() ns.OpenOptions() end)
    options:SetHeight(18)
    options:SetPoint("TOPRIGHT", -26, -2)
    applyFeatureToggles()
end

ns.OnConfigChanged(function(key)
    for _, featureKey in pairs(FEATURE_KEYS) do
        if key == featureKey then
            applyFeatureToggles()
        end
    end
end)

-- Opens the window on a tab (or the last/first visible one). A disabled tab
-- falls back to the first enabled tab with a hint.
function ns.OpenFeatures(tabName)
    if not window then
        createWindow()
    end
    if tabName and not isTabEnabled(tabName) then
        print("FlockSync: " .. TAB_LABELS[tabName] .. " is disabled. Enable it in /fs options.")
        tabName = nil
    end
    window:Show()
    window.tabs.Select(tabName or window.tabs.selected)
end

function ns.ToggleFeatures()
    if window and window:IsShown() then
        window:Hide()
    else
        ns.OpenFeatures()
    end
end

-- Login: the walkthrough until onboarding is done, then Role & Main once for
-- each new character on the account.
function ns.ShowStartupWindow()
    if not ns.IsOnboarded() then
        ns.OpenWalkthrough()
        return
    end
    local profile = ns.GetProfile()
    if not profile or profile.setupDone then
        return
    end
    profile.setupDone = true
    ns.OpenOptions("role")
    print("FlockSync: New character! Pick its role and Main. Open the FlockSync window with /fs, options with /fs options.")
end
