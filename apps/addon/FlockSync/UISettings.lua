local addonName, ns = ...

-- Settings toggles shared by the Options window and the walkthrough.
ns.DISPLAY_TOGGLES = {
    { key = "showMinimap", label = "Show minimap button" },
    { key = "showTooltips", label = "Show guild goals & crafters in item tooltips" },
}
ns.FEATURE_TOGGLES = {
    { key = "enableSchedule", label = "Raid Schedule (your raid assignments)" },
    { key = "enableCrafterSearch", label = "Guild Crafter Search" },
    { key = "enableLfgMatcher", label = "LFG Matcher (guildmates sharing your Gear Goals)" },
}

local listeners = {}

function ns.OnConfigChanged(callback)
    listeners[#listeners + 1] = callback
end

-- Saves a toggle and applies it immediately (minimap, feature tabs, ...).
function ns.SetConfigToggle(key, value)
    FlockSyncDB.config[key] = value and true or false
    if key == "showMinimap" and ns.SetMinimapButtonShown then
        ns.SetMinimapButtonShown(value)
    end
    for _, callback in ipairs(listeners) do
        callback(key, FlockSyncDB.config[key])
    end
end

-- Adds a heading and one checkbox per toggle; returns the next free y and a
-- Refresh function that re-reads the saved values.
function ns.AddToggleSection(parent, heading, toggles, y)
    local title = parent:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    title:SetPoint("TOPLEFT", 22, y)
    title:SetText(heading)
    y = y - 20
    local boxes = {}
    for _, toggle in ipairs(toggles) do
        local box = CreateFrame("CheckButton", nil, parent, "UICheckButtonTemplate")
        box:SetPoint("TOPLEFT", 20, y)
        box.text:SetText(toggle.label)
        box:SetScript("OnClick", function(self)
            ns.SetConfigToggle(toggle.key, self:GetChecked() and true or false)
        end)
        boxes[toggle.key] = box
        y = y - 28
    end
    local function refresh()
        for key, box in pairs(boxes) do
            box:SetChecked(ns.IsEnabled(key))
        end
    end
    return y - 8, refresh, boxes
end

-- Options > Display & Features tab.
function ns.BuildSettingsPanel(container)
    local y, refreshDisplay = ns.AddToggleSection(container, "Display", ns.DISPLAY_TOGGLES, -12)
    local refreshFeatures
    y, refreshFeatures = ns.AddToggleSection(container, "Features (tabs in the /fs window)",
        ns.FEATURE_TOGGLES, y)

    local note = ns.AddPanelText(container, "GameFontHighlightSmall", 400)
    note:SetPoint("TOPLEFT", 22, y)
    note:SetText("Professions & Goals is always available. Disabled features only hide in-game "
        .. "views; your character data is still synced.")

    local reset = ns.AddPanelButton(container, "Reset First-Time Walkthrough", 220, function()
        FlockSyncDB.config.hasCompletedOnboarding = false
        print("FlockSync: Walkthrough reset. Scanning and broadcasts pause until you click Finish.")
        ns.OpenWalkthrough()
    end)
    reset:SetHeight(24)
    reset:SetPoint("TOPLEFT", 22, y - 48)

    function container.Refresh()
        refreshDisplay()
        refreshFeatures()
    end
    ns.OnConfigChanged(function()
        if container:IsVisible() then
            container.Refresh()
        end
    end)
    return container
end
