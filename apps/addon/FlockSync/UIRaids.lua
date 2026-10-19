local addonName, ns = ...

local ROW_HEIGHT = 64
local DAY_INDEX = { SUN = 1, MON = 2, TUE = 3, WED = 4, THU = 5, FRI = 6, SAT = 7 }

local function todayIndex()
    if C_DateAndTime and C_DateAndTime.GetCurrentCalendarTime then
        local now = C_DateAndTime.GetCurrentCalendarTime()
        if now and now.weekday then
            return now.weekday
        end
    end
    return tonumber(date("%w")) + 1
end

-- Next occurrence first; unknown day codes sort last.
local function sortedRaids()
    local today = todayIndex()
    local raids = {}
    for _, raid in ipairs(ns.Snapshot.upcomingRaids) do
        raids[#raids + 1] = raid
    end
    local function daysAway(raid)
        local day = DAY_INDEX[raid.scheduledDay or ""]
        return day and (day - today) % 7 or 99
    end
    table.sort(raids, function(a, b)
        local da, db = daysAway(a), daysAway(b)
        if da ~= db then
            return da < db
        end
        return (a.startTime or "") < (b.startTime or "")
    end)
    return raids
end

local function playerStatus(raid)
    local guid = UnitGUID("player")
    for _, assignment in ipairs(raid.assignments) do
        if assignment.characterGuid == guid then
            if assignment.isBench then
                return "|cffffd100STANDBY / BENCH|r"
            end
            return string.format("|cff00ff00ASSIGNED: Group %d (%s)|r",
                assignment.groupIndex or 0, assignment.assignedRole or "?")
        end
    end
    return "|cff9d9d9dNOT SCHEDULED|r"
end

local function countAssignments(raid)
    local assigned, bench = 0, 0
    for _, assignment in ipairs(raid.assignments) do
        if assignment.isBench then
            bench = bench + 1
        else
            assigned = assigned + 1
        end
    end
    return assigned, bench
end

local function createRow(parent)
    local row = CreateFrame("Frame", nil, parent)
    row.bg = row:CreateTexture(nil, "BACKGROUND")
    row.bg:SetPoint("TOPLEFT", 0, -2)
    row.bg:SetPoint("BOTTOMRIGHT", 0, 2)
    row.bg:SetColorTexture(1, 1, 1, 0.05)
    row.title = ns.AddPanelText(row, "GameFontNormal", 370)
    row.title:SetPoint("TOPLEFT", 6, -6)
    row.when = ns.AddPanelText(row, "GameFontHighlightSmall", 370)
    row.when:SetPoint("TOPLEFT", 6, -24)
    row.badge = ns.AddPanelText(row, "GameFontNormalSmall", 190)
    row.badge:SetPoint("TOPLEFT", 6, -42)
    row.invite = ns.AddPanelButton(row, "Auto-Invite Assigned Team", 180, function(self)
        local raid = self:GetParent().item
        if raid then
            ns.RequestGuildRoster()
            ns.AutoInviteRaid(raid)
        end
    end)
    row.invite:SetPoint("TOPRIGHT", -6, -38)
    return row
end

local function bindRow(row, raid)
    row.title:SetText(raid.name .. " - " .. (raid.instanceName or "?"))
    local assigned, bench = countAssignments(raid)
    row.when:SetText(string.format("%s %s (server time)  |  %d assigned, %d bench",
        raid.scheduledDay or "?", raid.startTime or "", assigned, bench))
    row.badge:SetText(playerStatus(raid))
    row.invite:SetShown(ns.IsPlayerOfficer())
end

function ns.BuildSchedulePanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)

    local header = ns.AddPanelText(panel, "GameFontNormal", 410)
    header:SetPoint("TOPLEFT", 18, -6)
    header:SetText("Upcoming raids and your assignment")
    panel.status = ns.AddPanelText(panel, "GameFontDisableSmall", 410)
    panel.status:SetPoint("TOPLEFT", 18, -24)

    panel.list = ns.CreateScrollList(panel, {
        top = -48, bottom = 14, rowHeight = ROW_HEIGHT, rowCount = 5,
        createRow = createRow, bindRow = bindRow,
    })
    panel.empty = ns.AddPanelText(panel, "GameFontHighlightSmall", 400)
    panel.empty:SetPoint("TOPLEFT", 20, -56)

    function panel.Refresh()
        local raids = sortedRaids()
        panel.status:SetText(ns.DescribeSnapshot())
        panel.empty:SetShown(ns.HasSnapshot() and #raids == 0)
        panel.empty:SetText("No raid teams are scheduled.")
        panel.list.SetItems(raids)
    end

    local function refreshIfVisible()
        if panel:IsVisible() then
            panel.Refresh()
        end
    end
    ns.OnSnapshotChanged(refreshIfVisible)
    panel:SetScript("OnShow", ns.RequestGuildRoster)
    ns.RequestGuildRoster()
    return panel
end
