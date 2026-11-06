local addonName, ns = ...
local dialog

local function label(parent, text, x, y)
    local value = ns.AddPanelText(parent, "GameFontHighlightSmall", 390)
    value:SetPoint("TOPLEFT", x, y)
    value:SetText(text)
    return value
end
local function input(parent, x, y, width)
    local box = CreateFrame("EditBox", nil, parent, "InputBoxTemplate")
    box:SetSize(width, 22)
    box:SetPoint("TOPLEFT", x, y)
    box:SetAutoFocus(false)
    box:SetMaxBytes(320)
    box:SetScript("OnEscapePressed", function() dialog:Hide() end)
    return box
end
local function create()
    local frame = CreateFrame("Frame", "FlockSyncKillEditorFrame", UIParent, "BasicFrameTemplateWithInset")
    table.insert(UISpecialFrames, "FlockSyncKillEditorFrame")
    frame:SetSize(440, 365)
    frame:SetPoint("CENTER")
    frame:SetFrameStrata("DIALOG")
    frame:EnableMouse(true)
    label(frame, "Player name (First Last)", 20, -38)
    frame.name = input(frame, 24, -57, 390)
    label(frame, "Reason (maximum 500 characters; no tooltip notes)", 20, -90)
    local scroll = CreateFrame("ScrollFrame", nil, frame, "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 24, -113)
    scroll:SetSize(370, 96)
    local outline = CreateFrame("Frame", nil, frame, "BackdropTemplate")
    outline:SetPoint("TOPLEFT", scroll, "TOPLEFT", -5, 5)
    outline:SetPoint("BOTTOMRIGHT", scroll, "BOTTOMRIGHT", 5, -5)
    outline:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8X8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 8, edgeSize = 12,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
    })
    outline:SetBackdropColor(0, 0, 0, 0.6)
    outline:SetBackdropBorderColor(0.7, 0.7, 0.7, 1)
    outline:SetFrameLevel(scroll:GetFrameLevel())
    scroll:SetFrameLevel(outline:GetFrameLevel() + 1)
    frame.note = CreateFrame("EditBox", nil, scroll)
    frame.note:SetSize(370, 96)
    frame.note:EnableMouse(true)
    frame.note:SetMaxBytes(2000)
    frame.note:SetMultiLine(true)
    frame.note:SetAutoFocus(false)
    frame.note:SetFontObject("GameFontHighlightSmall")
    frame.note:SetScript("OnEscapePressed", function() frame:Hide() end)
    scroll:SetScrollChild(frame.note)
    scroll:EnableMouse(true)
    scroll:SetScript("OnMouseDown", function()
        if frame.note:IsEnabled() then frame.note:SetFocus() end
    end)
    frame.shared = CreateFrame("CheckButton", nil, frame, "UICheckButtonTemplate")
    frame.shared:SetPoint("TOPLEFT", 20, -224)
    frame.shared.text:SetText("Guild Shared (sends on save)")
    frame.personal = CreateFrame("CheckButton", nil, frame, "UICheckButtonTemplate")
    frame.personal:SetPoint("TOPLEFT", 240, -224)
    frame.personal.text:SetText("Personal (never synced)")
    frame.feedback = label(frame, "", 22, -262)
    frame.ok = ns.AddPanelButton(frame, "OK", 100, function()
        local ok, message
        if frame.item then
            ok, message = ns.ChangeKillTarget(frame.item, frame.note:GetText(), frame.removing)
        else
            ok, message = ns.SaveKillTarget(frame.name:GetText(), frame.targetRealm,
                frame.note:GetText(), frame.shared:GetChecked() == true, frame.personal:GetChecked() == true)
        end
        if ok then frame:Hide() else frame.feedback:SetText(message) end
    end)
    frame.ok:SetPoint("BOTTOMRIGHT", -130, 16)
    local cancel = ns.AddPanelButton(frame, "Cancel", 100, function() frame:Hide() end)
    cancel:SetPoint("BOTTOMRIGHT", -20, 16)
    function frame.Validate()
        local target, message = ns.ValidateKillTarget(frame.name:GetText(), frame.targetRealm, frame.note:GetText())
        local selected = frame.shared:GetChecked() or frame.personal:GetChecked()
        frame.ok:SetEnabled(target ~= nil and selected and ns.KillListEnabled())
        if not selected then message = "Select Shared, Personal, or both to enable OK." end
        if target and selected then
            message = frame.removing and "Confirm removal from this list only."
                or (ns.KillTextLength(target.note) .. "/500 characters"
                    .. (not frame.item and frame.shared:GetChecked() and " - sends to guild on save" or ""))
        end
        frame.feedback:SetText(message or "")
    end
    for _, box in ipairs({ frame.name, frame.note }) do box:SetScript("OnTextChanged", frame.Validate) end
    frame.shared:SetScript("OnClick", frame.Validate)
    frame.personal:SetScript("OnClick", frame.Validate)
    frame:Hide()
    return frame
end

function ns.OpenKillEditor(item, removing, target)
    if not ns.IsOnboarded() or not ns.KillListEnabled() then
        print("FlockSync: Complete setup and enable Kill List with /fs killoptions first.")
        return
    end
    if not dialog then dialog = create() end
    dialog.item, dialog.removing, dialog.guild = item, removing == true, ns.KillGuildKey()
    local entry = item and item.entry or target or {}
    dialog.targetRealm = item and entry.realm or GetRealmName()
    dialog.TitleText:SetText(removing and "Remove target?" or (item and "Edit reason" or "Add kill-list target"))
    dialog.name:SetText(entry.name or "")
    dialog.note:SetText(entry.note or "")
    dialog.name:SetEnabled(item == nil)
    dialog.note:SetEnabled(not removing)
    dialog.shared:SetChecked(item ~= nil and item.destination == "shared")
    dialog.personal:SetChecked(item ~= nil and item.destination == "personal")
    dialog.shared:SetEnabled(item == nil and ns.KillGuildKey() ~= nil)
    dialog.personal:SetEnabled(item == nil and ns.GetKillState().personalEnabled)
    dialog.ok:SetText(removing and "Remove" or "OK")
    dialog.Validate()
    dialog:Show()
end
ns.OnKillListChanged(function()
    if dialog and (not ns.KillListEnabled() or dialog.guild ~= ns.KillGuildKey()) then dialog:Hide() end
end)
