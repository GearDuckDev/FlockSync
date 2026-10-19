local addonName, ns = ...

-- First-time onboarding wizard. Until Finish is clicked, nothing is scanned or
-- broadcast (see ns.IsOnboarded).
local PAGE_COUNT = 3
local window
local pageIndex = 1

local function addText(parent, template, y, text)
    local label = ns.AddPanelText(parent, template, 400)
    label:SetPoint("TOPLEFT", 22, y)
    label:SetText(text)
    return label
end

local function buildWelcome(page)
    addText(page, "GameFontNormalLarge", -10, "Welcome to FlockSync!")
    addText(page, "GameFontHighlight", -40,
        "FlockSync keeps your guild organized. It shares your gear, roles, professions "
        .. "and raid availability with your guild's officers, who sync it to the guild "
        .. "website for rosters, raid lineups and loot planning.\n\n"
        .. "In return you get your raid schedule, a guild crafter search, item tooltips "
        .. "showing who needs or can craft an item, and an LFG matcher.\n\n"
        .. "This quick setup takes under a minute.")
end

local function buildPrivacy(page)
    addText(page, "GameFontNormalLarge", -10, "Privacy & Features")
    addText(page, "GameFontHighlightSmall", -36,
        "Shared with your guild only (hidden addon messages on the GUILD channel): character "
        .. "name, class, level, equipped gear, roles, Main/alt link, availability, raid "
        .. "lockouts, attunements, professions and Gear Goals. Nothing is shared until you "
        .. "click Finish. You can change these later with /fs options.")
    local y, refreshDisplay = ns.AddToggleSection(page, "Display", ns.DISPLAY_TOGGLES, -108)
    local _, refreshFeatures = ns.AddToggleSection(page, "Features", ns.FEATURE_TOGGLES, y)
    function page.Refresh()
        refreshDisplay()
        refreshFeatures()
    end
end

local function buildRole(page)
    addText(page, "GameFontNormalLarge", -10, "Your Role")
    addText(page, "GameFontHighlightSmall", -36,
        "Pick this character's role. If it is an alt, choose your Main so the guild "
        .. "groups your characters together.")
    page.controls = ns.BuildRoleControls(page, "FlockSyncWizard", -70, {})
    page.Refresh = page.controls.Refresh
end

local function showPage(index)
    pageIndex = index
    for i, page in ipairs(window.pages) do
        page:SetShown(i == index)
    end
    local page = window.pages[index]
    if page.Refresh then
        page.Refresh()
    end
    window.back:SetShown(index > 1)
    window.next:SetShown(index < PAGE_COUNT)
    window.finish:SetShown(index == PAGE_COUNT)
    window.step:SetText("Step " .. index .. " of " .. PAGE_COUNT)
end

local function finish()
    FlockSyncDB.config.hasCompletedOnboarding = true
    local profile = ns.GetProfile()
    if profile then
        profile.setupDone = true
    end
    window:Hide()
    ns.BroadcastUpdate("FULL_SCAN")
    print("FlockSync: Setup complete! Your character was shared with the guild. "
        .. "Use /fs for the FlockSync window, /fs options for settings, /fs help for commands.")
end

local function createWindow()
    window = ns.CreateWindow("FlockSyncWalkthroughFrame", "FlockSync Setup", 450, 444)
    window.pages = {}
    for index, build in ipairs({ buildWelcome, buildPrivacy, buildRole }) do
        local page = CreateFrame("Frame", nil, window)
        page:SetPoint("TOPLEFT", 0, -30)
        page:SetPoint("BOTTOMRIGHT", 0, 44)
        build(page)
        window.pages[index] = page
    end
    window.back = ns.AddPanelButton(window, "Back", 90, function() showPage(pageIndex - 1) end)
    window.back:SetPoint("BOTTOMLEFT", 16, 14)
    window.next = ns.AddPanelButton(window, "Next", 90, function() showPage(pageIndex + 1) end)
    window.next:SetPoint("BOTTOMRIGHT", -16, 14)
    window.finish = ns.AddPanelButton(window, "Finish", 90, finish)
    window.finish:SetPoint("BOTTOMRIGHT", -16, 14)
    window.step = ns.AddPanelText(window, "GameFontDisableSmall")
    window.step:SetPoint("BOTTOM", 0, 18)
end

function ns.OpenWalkthrough()
    if not window then
        createWindow()
    end
    window:Show()
    showPage(1)
end

function ns.IsWalkthroughShown()
    return window ~= nil and window:IsShown()
end
