local addonName, ns = ...

-- Row offsets are relative to the goals container, which flows below the profession summary.
local ROW_TOP = -40
local ROW_STEP = 36

local function touch()
    ns.PublishLocalScan()
end

local function makeEditBox(parent, x, y, width)
    local box = CreateFrame("EditBox", nil, parent, "InputBoxTemplate")
    box:SetSize(width, 20)
    box:SetPoint("TOPLEFT", x, y)
    box:SetAutoFocus(false)
    box:SetScript("OnEscapePressed", box.ClearFocus)
    box:SetScript("OnEnterPressed", box.ClearFocus)
    return box
end

local function acceptCursorItem(panel, index)
    if not (CursorHasItem and CursorHasItem()) then
        return false
    end
    local kind, itemId, itemLink = GetCursorInfo()
    if kind ~= "item" then
        return false
    end
    ClearCursor()
    if ns.SetGearGoal(index, itemId, itemLink) then
        touch()
        panel.Refresh()
    end
    return true
end

local function buildRow(panel, host, index)
    local y = ROW_TOP - (index - 1) * ROW_STEP
    local row = {}

    row.slot = CreateFrame("Button", nil, host)
    row.slot:SetSize(30, 30)
    row.slot:SetPoint("TOPLEFT", 0, y + 5)
    row.slot.bg = row.slot:CreateTexture(nil, "BACKGROUND")
    row.slot.bg:SetAllPoints()
    row.slot.bg:SetColorTexture(0, 0, 0, 0.5)
    row.slot.icon = row.slot:CreateTexture(nil, "ARTWORK")
    row.slot.icon:SetAllPoints()
    local function onDrop()
        acceptCursorItem(panel, index)
    end
    row.slot:SetScript("OnReceiveDrag", onDrop)
    row.slot:SetScript("OnClick", onDrop)
    row.slot:SetScript("OnEnter", function(self)
        local goal = ns.GetGearGoals().goals[index]
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        if goal then
            GameTooltip:SetHyperlink("item:" .. goal.itemId)
        else
            GameTooltip:SetText("Drop an item here")
        end
        GameTooltip:Show()
    end)
    row.slot:SetScript("OnLeave", GameTooltip_Hide)

    row.item = makeEditBox(host, 44, y, 110)
    row.item:SetScript("OnEditFocusLost", function(self)
        -- Let a suggestion click choose the item before refreshing the fields.
        C_Timer.After(0.15, function()
            if self:HasFocus() then return end
            local itemId = ns.ParseItemInput(self:GetText())
            local current = ns.GetGearGoals().goals[index]
            if itemId and (not current or current.itemId ~= itemId) then
                local link = self:GetText():match("|H(item:[^|]+)|h") and self:GetText() or nil
                if ns.SetGearGoal(index, itemId, link) then
                    touch()
                end
            elseif not itemId and self:GetText() == "" and current then
                ns.ClearGearGoal(index)
                touch()
            end
            panel.Refresh()
        end)
    end)
    ns.AttachGoalItemSearch(row.item, function(item)
        if ns.SetGearGoal(index, item.itemId, item.link) then
            touch()
            panel.Refresh()
        end
    end)

    row.note = makeEditBox(host, 164, y, 170)
    row.note:SetMaxLetters(80)
    row.note:SetScript("OnEditFocusLost", function(self)
        local current = ns.GetGearGoals().goals[index]
        if current and (current.note or "") ~= self:GetText() then
            ns.SetGearGoalNote(index, self:GetText())
            touch()
        end
    end)

    row.clear = CreateFrame("Button", nil, host, "UIPanelButtonTemplate")
    row.clear:SetSize(24, 22)
    row.clear:SetPoint("TOPLEFT", 344, y + 1)
    row.clear:SetText("X")
    row.clear:SetScript("OnClick", function()
        if ns.GetGearGoals().goals[index] then
            ns.ClearGearGoal(index)
            touch()
        end
        panel.Refresh()
    end)
    return row
end

local function addLabel(parent, text, x, y, template, width)
    local label = parent:CreateFontString(nil, "OVERLAY", template or "GameFontNormal")
    label:SetPoint("TOPLEFT", x, y)
    label:SetText(text)
    if width then
        label:SetWidth(width)
        label:SetJustifyH("LEFT")
    end
    return label
end

-- Builds the "Professions & Goals" tab contents inside parent.
function ns.BuildProfessionsPanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)

    panel.accepting = CreateFrame("CheckButton", nil, panel, "UICheckButtonTemplate")
    panel.accepting:SetPoint("TOPLEFT", 20, -8)
    panel.accepting.text:SetText("Accepting Guild Crafting Requests")
    panel.accepting:SetScript("OnClick", function(self)
        ns.SetAcceptingRequests(self:GetChecked())
        touch()
    end)

    addLabel(panel, "Scanned Professions", 22, -44)
    panel.summary = addLabel(panel, "", 22, -62, "GameFontHighlightSmall", 400)
    panel.summary:SetSpacing(2)

    -- Anchored to the summary's bottom so a longer profession list pushes the goals down.
    local goalsHost = CreateFrame("Frame", nil, panel)
    goalsHost:SetPoint("TOPLEFT", panel.summary, "BOTTOMLEFT", 0, -14)
    goalsHost:SetSize(400, -ROW_TOP + ns.MAX_GEAR_GOALS * ROW_STEP)
    panel.goalsHost = goalsHost

    addLabel(goalsHost, "Gear Goals (type name, ID/link, or drag item)", 0, 0)
    addLabel(goalsHost, "Item", 46, -20, "GameFontDisableSmall")
    addLabel(goalsHost, "Note (e.g. BRD Vault)", 166, -20, "GameFontDisableSmall")
    panel.rows = {}
    for index = 1, ns.MAX_GEAR_GOALS do
        panel.rows[index] = buildRow(panel, goalsHost, index)
    end

    function panel.Refresh()
        panel.accepting:SetChecked(ns.GetProfile().acceptingRequests == true)
        panel.summary:SetText(ns.ProfessionSummary())
        local goals = ns.GetGearGoals().goals
        for index, row in ipairs(panel.rows) do
            local goal = goals[index]
            if goal then
                local _, _, icon = ns.GetGoalItemInfo(goal.itemId)
                row.slot.icon:SetTexture(icon or 134400)
                row.slot.icon:Show()
                row.item:SetText(tostring(goal.itemId))
                row.note:SetText(goal.note or "")
            else
                row.slot.icon:Hide()
                row.item:SetText("")
                row.note:SetText("")
            end
        end
    end
    return panel
end
