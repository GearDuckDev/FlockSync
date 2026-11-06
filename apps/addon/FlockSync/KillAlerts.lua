local addonName, ns = ...

local lastAlert, popup, icons, plates = {}, nil, {}, {}
local function createPopup()
    local frame = CreateFrame("Frame", nil, UIParent, "BackdropTemplate")
    frame:SetSize(360, 76)
    frame:SetPoint("TOP", UIParent, "TOP", 0, -180)
    frame:SetFrameStrata("DIALOG")
    frame:SetBackdrop({ bgFile = "Interface\\Buttons\\WHITE8X8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border", edgeSize = 12 })
    frame:SetBackdropColor(0.18, 0.02, 0.02, 0.95)
    frame.title = ns.AddPanelText(frame, "GameFontNormalLarge", 320)
    frame.title:SetPoint("TOPLEFT", 18, -12)
    frame.detail = ns.AddPanelText(frame, "GameFontHighlightSmall", 320)
    frame.detail:SetPoint("TOPLEFT", 18, -38)
    local close = CreateFrame("Button", nil, frame, "UIPanelCloseButton")
    close:SetPoint("TOPRIGHT")
    close:SetScript("OnClick", function() frame:Hide() end)
    frame:EnableKeyboard(true)
    frame:SetScript("OnKeyDown", function(self, key)
        if key == "ESCAPE" then self:SetPropagateKeyboardInput(false); self:Hide()
        else self:SetPropagateKeyboardInput(true) end
    end)
    frame:Hide()
    return frame
end
function ns.ShowKillAlert(target)
    local state, now = ns.GetKillState(), GetServerTime()
    if not state or not state.enabled or not ns.KillMatch(target.name, target.realm) then return end
    local key = target.realm .. "\031" .. target.name:lower()
    if lastAlert[key] and now - lastAlert[key] < 60 then return end
    lastAlert[key] = now
    for old, stamp in pairs(lastAlert) do if now - stamp >= 60 then lastAlert[old] = nil end end
    if state.popupEnabled then
        popup = popup or createPopup()
        popup.title:SetText("Kill-list enemy identified")
        popup.detail:SetText(ns.KillDisplayText(target.name) .. "\n" .. ns.KillDisplayText(ns.KillZone()))
        popup.target = target
        popup:Show()
        popup.generation = (popup.generation or 0) + 1
        local generation = popup.generation
        C_Timer.After(6, function() if popup.generation == generation then popup:Hide() end end)
    end
    if state.soundEnabled then
        if PlaySound and SOUNDKIT and SOUNDKIT.RAID_WARNING then PlaySound(SOUNDKIT.RAID_WARNING, "Master")
        else print("FlockSync: Alert sound unavailable on this client; popup settings are independent.") end
    end
end
function ns.UpdateKillSkull(unit, visible)
    if type(unit) ~= "string" or not unit:match("^nameplate%d+$") then return end
    plates[unit] = visible and true or nil
    local icon = icons[unit]
    local state = ns.GetKillState()
    local target = visible and ns.KillUnitTarget(unit)
    local allowed = ns.IsOnboarded() and state and state.enabled and state.skullEnabled and target
        and ns.KillReadable(UnitIsEnemy("player", unit)) == true and ns.KillMatch(target.name, target.realm)
    local plate = allowed and C_NamePlate and C_NamePlate.GetNamePlateForUnit(unit)
    if not plate then if icon then icon:Hide() end; return end
    if not icon then
        icon = CreateFrame("Frame", nil, plate)
        icon:SetSize(24, 24)
        local texture = icon:CreateTexture(nil, "OVERLAY")
        texture:SetAllPoints()
        texture:SetTexture("Interface\\TargetingFrame\\UI-RaidTargetingIcons")
        texture:SetTexCoord(0.75, 1, 0.25, 0.5)
        icons[unit] = icon
    end
    icon:SetParent(plate)
    icon:ClearAllPoints()
    icon:SetPoint("BOTTOM", plate, "TOP", 0, 4)
    icon:Show()
end
function ns.RefreshKillSkulls()
    for unit in pairs(plates) do ns.UpdateKillSkull(unit, true) end
    local state = ns.GetKillState()
    if popup and (not state or not state.enabled or not state.popupEnabled
        or not ns.KillMatch(popup.target.name, popup.target.realm)) then popup:Hide() end
end
function ns.ResetKillAlerts()
    lastAlert = {}
    plates = {}
    if popup then popup:Hide() end
    for _, icon in pairs(icons) do icon:Hide() end
end
