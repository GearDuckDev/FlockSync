local addonName, ns = ...

-- Settings window: Role & Main, availability/lockouts, display and feature toggles.
local PANEL_TOP = -52
local window, rolePanel

local function countTracked()
    local count = 0
    for _ in pairs(FlockSyncDB.characters) do
        count = count + 1
    end
    return count
end

local function refreshStatus()
    if not rolePanel then
        return
    end
    local reason = ns.GetOfficerStatusReason()
    rolePanel.officerStatus:SetText(reason and ("Officer Status: Active (" .. reason .. ")")
        or "Officer Status: Inactive")
    rolePanel.officerCheck:SetChecked(FlockSyncDB.config.forceOfficerMode == true)
    rolePanel.countText:SetText("Tracked guild characters: " .. countTracked())
end

function ns.RefreshOfficerStatus()
    refreshStatus()
end

local statusFrame = CreateFrame("Frame")
statusFrame:RegisterEvent("PLAYER_LOGIN")
statusFrame:RegisterEvent("PLAYER_GUILD_UPDATE")
statusFrame:RegisterEvent("GUILD_ROSTER_UPDATE")
statusFrame:SetScript("OnEvent", refreshStatus)

StaticPopupDialogs["FLOCKSYNC_CONFIRM_OFFICER_MODE"] = {
    text = "Warning: Forcing Officer Mode allows this client to intercept and store all guild "
        .. "data locally for testing. This is typically only used by developers. Are you sure "
        .. "you want to enable this?",
    button1 = YES,
    button2 = NO,
    timeout = 0,
    whileDead = true,
    hideOnEscape = true,
    showAlert = true,
    OnAccept = function()
        FlockSyncDB.config.forceOfficerMode = true
        refreshStatus()
    end,
    -- No / Escape: the checkbox was never applied, so redraw the saved value.
    OnCancel = function()
        refreshStatus()
    end,
}

local function onOfficerClick(self)
    if self:GetChecked() then
        -- Do not apply yet; the popup decides.
        self:SetChecked(false)
        StaticPopup_Show("FLOCKSYNC_CONFIRM_OFFICER_MODE")
        return
    end
    FlockSyncDB.config.forceOfficerMode = false
    refreshStatus()
end

local function publishVerbose()
    if not ns.IsOnboarded() then
        print("FlockSync: Finish the first-time walkthrough (/fs) before broadcasting.")
        return
    end
    local character = ns.PublishLocalScan()
    refreshStatus()
    if character then
        print("FlockSync: Updated " .. character.name .. " (Main: "
            .. (character.mainCharacterName or "Self") .. "). Total tracked characters: "
            .. countTracked() .. ". Type /reload to write to disk.")
    end
end

local function buildRolePanel(container)
    rolePanel = container
    container.scanButton = ns.AddPanelButton(container, "Force Scan & Broadcast", 200, publishVerbose)
    container.scanButton:SetHeight(28)
    container.officerCheck = CreateFrame("CheckButton", nil, container, "UICheckButtonTemplate")
    container.officerCheck.text:SetText("Officer Mode (Local Test)")
    container.officerCheck:SetScript("OnClick", onOfficerClick)
    container.officerStatus = ns.AddPanelText(container, "GameFontHighlightSmall", 390)
    container.officerStatus:SetPoint("TOPLEFT", container.officerCheck, "BOTTOMLEFT", 2, -2)
    container.countText = container:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    container.countText:SetPoint("BOTTOMLEFT", 22, 18)

    container.controls = ns.BuildRoleControls(container, "FlockSyncOptions", -38, {
        includeRemove = true,
        onChange = refreshStatus,
        onLayout = function(y)
            container.scanButton:ClearAllPoints()
            container.scanButton:SetPoint("TOPLEFT", 22, y)
            container.officerCheck:ClearAllPoints()
            container.officerCheck:SetPoint("TOPLEFT", 20, y - 43)
        end,
    })
    function container.Refresh()
        container.controls.Refresh()
        refreshStatus()
    end
    return container
end

local function createWindow()
    window = ns.CreateWindow("FlockSyncOptionsFrame", "FlockSync Options", 450, 444)
    local tabs = ns.CreateTabHost(window, PANEL_TOP)
    tabs.Add("role", "Role & Main", 10, -28, 110, buildRolePanel)
    tabs.Add("availability", "Availability & Lockouts", 122, -28, 165, ns.BuildAvailabilityPanel)
    tabs.Add("settings", "Display & Features", 289, -28, 150, ns.BuildSettingsPanel)
    window.tabs = tabs
end

function ns.OpenOptions(tabName)
    if not window then
        createWindow()
    end
    window:Show()
    window.tabs.Select(tabName or window.tabs.selected or "role")
end

function ns.ToggleOptions()
    if window and window:IsShown() then
        window:Hide()
    else
        ns.OpenOptions()
    end
end
