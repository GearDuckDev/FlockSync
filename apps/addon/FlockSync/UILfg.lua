local addonName, ns = ...

local ROW_HEIGHT = 24
local ROLE_LABELS = { TANK = "Tank", HEALER = "Healer", DPS = "DPS" }

-- Pairs each of my Gear Goals with online guildmates who need the same item.
local function findMatches()
    local results, offline = {}, 0
    for _, goal in ipairs(ns.GetGearGoals().goals) do
        for _, need in ipairs(ns.Snapshot.goalsByItem[goal.itemId] or {}) do
            if not ns.IsOwnCharacter(need.characterGuid) then
                local rosterName = ns.FindOnlineGuildmate(need.characterGuid, need.characterName)
                if rosterName then
                    results[#results + 1] = { itemId = goal.itemId, need = need, rosterName = rosterName }
                else
                    offline = offline + 1
                end
            end
        end
    end
    return results, offline
end

local function createRow(parent)
    local row = CreateFrame("Button", nil, parent)
    row:SetHighlightTexture("Interface\\QuestFrame\\UI-QuestTitleHighlight")
    row.icon = row:CreateTexture(nil, "ARTWORK")
    row.icon:SetSize(20, 20)
    row.icon:SetPoint("LEFT", 2, 0)
    row.itemName = ns.AddPanelText(row, "GameFontHighlightSmall", 140)
    row.itemName:SetPoint("LEFT", row.icon, "RIGHT", 6, 0)
    row.itemName:SetWordWrap(false)
    row.player = ns.AddPanelText(row, "GameFontHighlightSmall", 150)
    row.player:SetPoint("LEFT", 176, 0)
    row.player:SetWordWrap(false)
    row.invite = ns.AddPanelButton(row, "Invite", 56, function(self)
        local match = self:GetParent().item
        if match then
            ns.InviteCharacter(match.rosterName)
        end
    end)
    row.invite:SetPoint("RIGHT", -2, 0)
    row:SetScript("OnEnter", function(self)
        if not self.item then return end
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        GameTooltip:SetHyperlink("item:" .. self.item.itemId)
        GameTooltip:Show()
    end)
    row:SetScript("OnLeave", GameTooltip_Hide)
    return row
end

local function bindRow(row, match)
    local name, _, icon = ns.GetGoalItemInfo(match.itemId)
    row.icon:SetTexture(icon or 134400)
    row.itemName:SetText(name or ("Item #" .. match.itemId))
    local role = match.need.role and (" - " .. (ROLE_LABELS[match.need.role] or match.need.role)) or ""
    row.player:SetText(ns.ClassColoredName(match.need.characterName, match.need.classId) .. role)
end

local function emptyText(goalCount, offline)
    if not ns.HasSnapshot() then
        return ns.DescribeSnapshot()
    end
    if goalCount == 0 then
        return "Set Gear Goals in the Professions & Goals tab to find guildmates chasing the same loot."
    end
    if offline > 0 then
        return "Guildmates who share your goals are offline right now."
    end
    return "No other guildmates share your current Gear Goals."
end

function ns.BuildLfgPanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)

    local header = ns.AddPanelText(panel, "GameFontNormal", 410)
    header:SetPoint("TOPLEFT", 18, -6)
    header:SetText("Online guildmates chasing your Gear Goals")
    panel.status = ns.AddPanelText(panel, "GameFontDisableSmall", 410)
    panel.status:SetPoint("TOPLEFT", 18, -24)

    panel.list = ns.CreateScrollList(panel, {
        top = -48, bottom = 14, rowHeight = ROW_HEIGHT, rowCount = 13,
        createRow = createRow, bindRow = bindRow,
    })
    panel.empty = ns.AddPanelText(panel, "GameFontHighlightSmall", 400)
    panel.empty:SetPoint("TOPLEFT", 20, -56)

    function panel.Refresh()
        local results, offline = findMatches()
        panel.status:SetText(string.format("%d online match(es), %d offline.  %s",
            #results, offline, ns.HasSnapshot() and "" or "No snapshot yet."))
        panel.empty:SetShown(#results == 0)
        panel.empty:SetText(emptyText(#ns.GetGearGoals().goals, offline))
        panel.list.SetItems(results)
    end

    local pending = false
    local function refreshSoon()
        if pending then return end
        pending = true
        C_Timer.After(0.2, function()
            pending = false
            if panel:IsVisible() then
                panel.Refresh()
            end
        end)
    end
    ns.OnSnapshotChanged(refreshSoon)
    ns.OnGuildRosterChanged(refreshSoon)
    panel:RegisterEvent("GET_ITEM_INFO_RECEIVED")
    panel:SetScript("OnEvent", function(_, _, itemId)
        if itemId == nil then
            refreshSoon()
            return
        end
        for _, goal in ipairs(ns.GetGearGoals().goals) do
            if goal.itemId == itemId then
                refreshSoon()
                return
            end
        end
    end)
    panel:SetScript("OnShow", ns.RequestGuildRoster)
    ns.RequestGuildRoster()
    return panel
end
