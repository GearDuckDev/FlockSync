local addonName, ns = ...

local function touch()
    ns.GetAccountAvailability().updatedAt = GetServerTime()
    ns.PublishLocalScan()
end

local function makeSimpleDropdown(parent, name, x, y, width, options, getValue, setValue)
    local dropdown = CreateFrame("Frame", name, parent, "UIDropDownMenuTemplate")
    dropdown:SetPoint("TOPLEFT", x, y)
    UIDropDownMenu_SetWidth(dropdown, width)
    UIDropDownMenu_Initialize(dropdown, function(_, level)
        for _, option in ipairs(options) do
            local info = UIDropDownMenu_CreateInfo()
            info.text = option
            info.checked = getValue() == option
            info.func = function()
                setValue(option)
                UIDropDownMenu_SetText(dropdown, option)
            end
            UIDropDownMenu_AddButton(info, level)
        end
    end)
    return dropdown
end

local function hourOptions()
    local hours = {}
    for hour = 0, 23 do
        hours[#hours + 1] = string.format("%02d:00", hour)
    end
    return hours
end

local function formatReset(seconds)
    local days = math.floor(seconds / 86400)
    local hours = math.floor((seconds % 86400) / 3600)
    if days > 0 then
        return days .. "d " .. hours .. "h"
    end
    return hours .. "h " .. math.floor((seconds % 3600) / 60) .. "m"
end

local function lockoutSummary()
    local lines = {}
    local now = GetServerTime()
    for _, lockout in ipairs(ns.ScanLockouts().lockouts) do
        lines[#lines + 1] = string.format("%s  %d/%d  resets in %s",
            lockout.instanceName, lockout.completedEncounters,
            lockout.numEncounters, formatReset(lockout.resetAt - now))
    end
    if #lines == 0 then
        return "No active raid lockouts detected."
    end
    return table.concat(lines, "\n")
end

local function addLabel(parent, text, x, y, template)
    local label = parent:CreateFontString(nil, "OVERLAY", template or "GameFontNormal")
    label:SetPoint("TOPLEFT", x, y)
    label:SetText(text)
    return label
end

local function addDayButtons(panel)
    panel.dayButtons = {}
    for index, day in ipairs(ns.DAYS) do
        local y = -74 - (index - 1) * 25
        addLabel(panel, day, 22, y - 5)
        local button = CreateFrame("Button", nil, panel, "UIPanelButtonTemplate")
        button:SetSize(150, 22)
        button:SetPoint("TOPLEFT", 80, y)
        button:SetScript("OnClick", function()
            local availability = ns.GetAccountAvailability()
            local current = availability.days[day]
            local nextIndex = 1
            for i, status in ipairs(ns.STATUSES) do
                if status == current then
                    nextIndex = i % #ns.STATUSES + 1
                end
            end
            availability.days[day] = ns.STATUSES[nextIndex]
            button:SetText(ns.STATUSES[nextIndex])
            touch()
        end)
        panel.dayButtons[day] = button
    end
end

-- Builds the "Raid Availability & Lockouts" tab contents inside parent.
function ns.BuildAvailabilityPanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)

    addLabel(panel, "Timezone", 22, -14)
    panel.timezone = makeSimpleDropdown(panel, "FlockSyncTimezone", 125, -6, 80,
        ns.TIMEZONES,
        function() return ns.GetAccountAvailability().timezone end,
        function(value)
            ns.GetAccountAvailability().timezone = value
            touch()
        end)

    -- Applies to every kind of group content: raids, dungeons and PvP.
    addLabel(panel, "Group Play Hours", 22, -46)
    local hours = hourOptions()
    panel.startTime = makeSimpleDropdown(panel, "FlockSyncStartTime", 125, -38, 65,
        hours,
        function() return ns.GetAccountAvailability().startTime end,
        function(value)
            ns.GetAccountAvailability().startTime = value
            touch()
        end)
    addLabel(panel, "to", 242, -46)
    panel.endTime = makeSimpleDropdown(panel, "FlockSyncEndTime", 255, -38, 65,
        hours,
        function() return ns.GetAccountAvailability().endTime end,
        function(value)
            ns.GetAccountAvailability().endTime = value
            touch()
        end)

    addDayButtons(panel)

    addLabel(panel, "Active Raid Lockouts", 22, -258)
    panel.lockouts = addLabel(panel, "", 22, -276, "GameFontHighlightSmall")
    panel.lockouts:SetJustifyH("LEFT")
    panel.lockouts:SetWidth(340)

    function panel.Refresh()
        local availability = ns.GetAccountAvailability()
        UIDropDownMenu_SetText(panel.timezone, availability.timezone)
        UIDropDownMenu_SetText(panel.startTime, availability.startTime)
        UIDropDownMenu_SetText(panel.endTime, availability.endTime)
        for _, day in ipairs(ns.DAYS) do
            panel.dayButtons[day]:SetText(availability.days[day] or "UNAVAILABLE")
        end
        panel.lockouts:SetText(lockoutSummary())
        ns.RequestLockouts()
    end
    return panel
end
