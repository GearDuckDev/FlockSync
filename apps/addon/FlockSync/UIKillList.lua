local addonName, ns = ...

function ns.AddKillToggles(parent, y, compact)
    local boxes = {}
    for index, option in ipairs({
        { key = "enabled", text = "Enable Kill List (this character)" },
        { key = "personalEnabled", text = "Enable my personal list" },
        { key = "popupEnabled", text = "Local enemy popup" },
        { key = "soundEnabled", text = "Local enemy alert sound" },
        { key = "skullEnabled", text = "Local-only nameplate skull (not a raid mark)" },
        { key = "historyEnabled", text = "Show battle history" },
        { key = "reportEnabled", text = "Share sightings and battles for published targets" },
    }) do
        if compact and index > 2 then break end
        local box = CreateFrame("CheckButton", nil, parent, "UICheckButtonTemplate")
        box:SetPoint("TOPLEFT", 20, y - (index - 1) * 32)
        box.text:SetText(option.text)
        box:SetScript("OnClick", function(self) ns.SetKillSetting(option.key, self:GetChecked() == true) end)
        boxes[option.key] = box
    end
    return function()
        local state = ns.GetKillState()
        for key, box in pairs(boxes) do
            box:SetChecked(state and state[key] == true)
            box:SetEnabled(state ~= nil)
        end
    end
end

function ns.BuildKillSettings(parent)
    local text = ns.AddPanelText(parent, "GameFontHighlightSmall", 400)
    text:SetPoint("TOPLEFT", 22, -14)
    text:SetText("Selecting Guild Shared sends the target and note when saved. Existing legacy drafts "
        .. "stay private until Publish. Shared entries sync "
        .. "with online guildmates, even when this tab is disabled. Local alerts have a "
        .. "60-second per-target cooldown; remote sightings never trigger them.\n\n"
        .. "Personal entries never sync. Turning Personal off keeps entries but ignores "
        .. "personal-only targets. Turning Kill List off keeps all entries.")
    parent.Refresh = ns.AddKillToggles(parent, -130)
    ns.OnKillListChanged(function() if parent:IsVisible() then parent.Refresh() end end)
    return parent
end

function ns.BuildKillPanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)
    local notice = ns.AddPanelText(panel, "GameFontHighlightSmall", 400)
    notice:SetPoint("TOPLEFT", 20, -10)
    notice:SetText("Guild Shared sends on save. Old drafts need Publish. Guild catch-up is automatic.")
    local add = ns.AddPanelButton(panel, "Add target", 110, function() ns.OpenKillEditor() end)
    add:SetPoint("TOPLEFT", 20, -45)
    local settings = ns.AddPanelButton(panel, "Settings", 90, function() ns.OpenOptions("killlist") end)
    settings:SetPoint("TOPRIGHT", -20, -45)
    local status = ns.AddPanelText(panel, "GameFontHighlightSmall", 400)
    status:SetPoint("BOTTOMLEFT", 20, 14)
    local list = ns.CreateScrollList(panel, {
        top = -80, bottom = 40, rowHeight = 115, rowCount = 2,
        createRow = function(host)
            local row = CreateFrame("Frame", nil, host)
            row.name = ns.AddPanelText(row, "GameFontNormal", 280)
            row.name:SetPoint("TOPLEFT", 0, 0)
            row.author = ns.AddPanelText(row, "GameFontDisableSmall", 280)
            row.author:SetPoint("TOPLEFT", 0, -18)
            row.note = ns.AddPanelText(row, "GameFontHighlightSmall", 280)
            row.note:SetPoint("TOPLEFT", 0, -35)
            row.note:SetHeight(38)
            row.edit = ns.AddPanelButton(row, "Edit", 78, function() ns.OpenKillEditor(row.item) end)
            row.edit:SetPoint("TOPRIGHT", 0, 0)
            row.remove = ns.AddPanelButton(row, "Remove", 78, function() ns.OpenKillEditor(row.item, true) end)
            row.remove:SetPoint("TOPRIGHT", 0, -27)
            row.publish = ns.AddPanelButton(row, "Publish", 78, function() ns.PublishKillDraft(row.item) end)
            row.publish:SetPoint("TOPRIGHT", 0, -54)
            row.seen = ns.AddPanelText(row, "GameFontDisableSmall", 280)
            row.seen:SetPoint("TOPLEFT", 0, -77)
            row.history = ns.AddPanelButton(row, "History", 78, function() ns.OpenKillHistory(row.item) end)
            row.history:SetPoint("TOPRIGHT", 0, -81)
            return row
        end,
        bindRow = function(row, item)
            row.name:SetText(ns.KillDisplayText(item.entry.name))
            row.author:SetText((item.destination == "shared"
                and (item.entry.sharedLive and "Guild shared" or "Shared draft") or "Personal")
                .. " - " .. ns.KillDisplayText(item.entry.author))
            row.note:SetText(ns.KillPreview(item.entry.note))
            row.edit:SetEnabled(ns.CanChangeKill(item, false))
            row.remove:SetEnabled(ns.CanChangeKill(item, true))
            row.publish:SetShown(item.destination == "shared" and not item.entry.sharedLive)
            local seen = ns.KillObservationRows(item, false)[1]
            row.seen:SetText(seen and ("Seen: " .. ns.KillDisplayText(seen.zone) .. "\n"
                .. date("%m-%d-%Y %H:%M", seen.timestamp)) or "Not seen locally or reported yet")
            row.history:SetShown(ns.GetKillState().historyEnabled)
        end,
    })
    function panel.Refresh()
        local entries = ns.KillEntries()
        list.SetItems(entries)
        status:SetText(#entries == 0 and "No visible entries. Use Add target or /fs kill add."
            or (#entries .. " entries. Edits and removal apply to one list only."))
    end
    ns.OnKillListChanged(function() if panel:IsVisible() then panel.Refresh() end end)
    return panel
end
