local addonName, ns = ...
local dialog
local function create()
    local frame = CreateFrame("Frame", nil, UIParent, "BackdropTemplate")
    frame:SetSize(460, 360)
    frame:SetPoint("CENTER")
    frame:SetFrameStrata("DIALOG")
    frame:EnableMouse(true)
    frame:SetBackdrop({ bgFile = "Interface\\Buttons\\WHITE8X8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border", edgeSize = 12 })
    frame:SetBackdropColor(0.04, 0.04, 0.06, 0.98)
    frame.title = ns.AddPanelText(frame, "GameFontNormalLarge", 395)
    frame.title:SetPoint("TOPLEFT", 18, -16)
    local close = CreateFrame("Button", nil, frame, "UIPanelCloseButton")
    close:SetPoint("TOPRIGHT")
    close:SetScript("OnClick", function() frame:Hide() end)
    frame:EnableKeyboard(true)
    frame:SetScript("OnKeyDown", function(self, key)
        if key == "ESCAPE" then self:SetPropagateKeyboardInput(false); self:Hide()
        else self:SetPropagateKeyboardInput(true) end
    end)
    frame.list = ns.CreateScrollList(frame, {
        top = -52, bottom = 55, rowHeight = 70, rowCount = 3,
        createRow = function(host)
            local row = CreateFrame("Frame", nil, host)
            row.text = ns.AddPanelText(row, "GameFontHighlightSmall", 385)
            row.text:SetPoint("TOPLEFT")
            return row
        end,
        bindRow = function(row, entry)
            row.text:SetText(date("%m-%d-%Y %H:%M", entry.timestamp) .. " - " .. entry.kind
                .. "\n" .. ns.KillDisplayText(entry.actor) .. " -> " .. ns.KillDisplayText(entry.victim)
                .. "\n" .. ns.KillDisplayText(entry.zone) .. " | Reporter: " .. ns.KillDisplayText(entry.reporter))
        end,
    })
    frame.footer = ns.AddPanelText(frame, "GameFontDisableSmall", 410)
    frame.footer:SetPoint("BOTTOMLEFT", 18, 15)
    frame:Hide()
    return frame
end
function ns.OpenKillHistory(item)
    local state, targets = ns.GetKillState(), ns.KillStore(item.destination)
    local current = targets and targets[item.key]
    if not state or not state.enabled or not state.historyEnabled
        or (item.destination == "personal" and not state.personalEnabled)
        or not current or current.deleted or current.createdAt ~= item.entry.createdAt then
        if dialog then dialog:Hide() end
        return
    end
    dialog = dialog or create()
    dialog.item, dialog.guild = item, ns.KillGuildKey()
    local rows = ns.KillObservationRows(item, true)
    dialog.title:SetText(ns.KillDisplayText(item.entry.name) .. " - history")
    dialog.list.SetItems(rows)
    dialog.footer:SetText(#rows == 0 and "No verified battles recorded. Unreadable/ambiguous deaths are not guessed."
        or (#rows .. " records. Latest 90 days; 5,000 guild battles maximum."))
    dialog:Show()
end
ns.OnKillListChanged(function()
    if not dialog or not dialog:IsShown() then return end
    if not ns.KillListEnabled() or not ns.GetKillState().historyEnabled or dialog.guild ~= ns.KillGuildKey() then
        dialog:Hide()
    else ns.OpenKillHistory(dialog.item) end
end)
