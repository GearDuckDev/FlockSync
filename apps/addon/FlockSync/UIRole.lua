local addonName, ns = ...

-- Role, off-spec and Main controls, shared by the Options window and the
-- first-time walkthrough. Each instance needs a unique dropdown name prefix.
local ROLE_LABELS = { TANK = "Tank", HEALER = "Healer", DPS = "DPS" }
local DROPDOWN_X = 135

local function selfMainLabel()
    return (ns.GetPlayerFullName() or "This Character") .. " (This Character)"
end

local function otherAccountCharacters()
    local others = {}
    local playerGuid = UnitGUID("player")
    for guid, character in pairs(FlockSyncDB.accountCharacters) do
        if guid ~= playerGuid then
            others[#others + 1] = character
        end
    end
    table.sort(others, function(a, b) return a.name < b.name end)
    return others
end

StaticPopupDialogs["FLOCKSYNC_REMOVE_CHARACTER"] = {
    text = "Stop tracking %s? Use this for characters you deleted in the client.",
    button1 = YES,
    button2 = NO,
    timeout = 0,
    whileDead = true,
    hideOnEscape = true,
    OnAccept = function(_, data)
        if data and ns.RemoveAccountCharacter(data.guid) then
            print("FlockSync: Removed " .. data.name .. ". Type /reload to write to disk.")
            if data.onRemoved then
                data.onRemoved()
            end
        end
    end,
}

local function addOption(level, text, checked, onSelect, disabled)
    local info = UIDropDownMenu_CreateInfo()
    info.text = text
    info.checked = checked
    info.notCheckable = checked == nil
    info.disabled = disabled
    info.func = onSelect
    UIDropDownMenu_AddButton(info, level)
end

-- options: includeRemove (bool), onChange(), onLayout(nextY)
function ns.BuildRoleControls(container, prefix, top, options)
    options = options or {}
    local controls = {}

    local function changed()
        ns.PublishLocalScan()
        if options.onChange then
            options.onChange()
        end
    end

    local function touchRole(profile)
        profile.role.updatedAt = GetServerTime()
        changed()
    end

    local function row(text, suffix)
        local label = container:CreateFontString(nil, "OVERLAY", "GameFontNormal")
        label:SetText(text)
        local dropdown = CreateFrame("Frame", prefix .. suffix, container, "UIDropDownMenuTemplate")
        UIDropDownMenu_SetWidth(dropdown, 150)
        return { label = label, dropdown = dropdown }
    end

    local function place(entry, y)
        entry.label:ClearAllPoints()
        entry.label:SetPoint("TOPLEFT", 22, y - 8)
        entry.dropdown:ClearAllPoints()
        entry.dropdown:SetPoint("TOPLEFT", DROPDOWN_X, y)
    end

    local function roleMenu(dropdown, field)
        UIDropDownMenu_Initialize(dropdown, function(_, level)
            for _, role in ipairs({ "TANK", "HEALER", "DPS" }) do
                addOption(level, ROLE_LABELS[role], nil, function()
                    local profile = ns.GetProfile()
                    profile.role[field] = role
                    if field == "offSpecRole" then
                        -- Choosing an off-spec role implies the off-spec is in use.
                        profile.role.offSpecEnabled = true
                        controls.offSpecCheck:SetChecked(true)
                    end
                    UIDropDownMenu_SetText(dropdown, ROLE_LABELS[role])
                    touchRole(profile)
                end)
            end
        end)
    end

    local function mainMenu(dropdown)
        UIDropDownMenu_Initialize(dropdown, function(_, level)
            local profile = ns.GetProfile()
            local function choose(character, label)
                profile.mainCharacterGuid = character and character.guid or nil
                profile.mainCharacterName = character and character.name or nil
                UIDropDownMenu_SetText(dropdown, label)
                changed()
            end
            addOption(level, selfMainLabel(), profile.mainCharacterGuid == nil,
                function() choose(nil, selfMainLabel()) end)
            for _, character in ipairs(otherAccountCharacters()) do
                addOption(level, character.name, profile.mainCharacterGuid == character.guid,
                    function() choose(character, character.name) end)
            end
        end)
    end

    local function removeMenu(dropdown)
        UIDropDownMenu_Initialize(dropdown, function(_, level)
            local others = otherAccountCharacters()
            if #others == 0 then
                addOption(level, "No other characters", nil, nil, true)
            end
            for _, character in ipairs(others) do
                addOption(level, character.name, nil, function()
                    StaticPopup_Show("FLOCKSYNC_REMOVE_CHARACTER", character.name, nil, {
                        guid = character.guid, name = character.name,
                        onRemoved = function() controls.Refresh(); changed() end,
                    })
                end)
            end
        end)
    end

    controls.primaryRow = row("Primary Role", "PrimaryRole")
    roleMenu(controls.primaryRow.dropdown, "primaryRole")
    controls.offSpecCheck = CreateFrame("CheckButton", nil, container, "UICheckButtonTemplate")
    controls.offSpecCheck.text:SetText("Off-Spec Enabled")
    controls.offSpecCheck:SetScript("OnClick", function(self)
        local profile = ns.GetProfile()
        profile.role.offSpecEnabled = self:GetChecked() and true or false
        touchRole(profile)
        controls.Layout()
    end)
    controls.offSpecRow = row("Off-Spec Role", "OffSpecRole")
    roleMenu(controls.offSpecRow.dropdown, "offSpecRole")
    controls.mainRow = row("Main Character", "MainCharacter")
    mainMenu(controls.mainRow.dropdown)
    if options.includeRemove then
        controls.removeRow = row("Remove Character", "RemoveCharacter")
        removeMenu(controls.removeRow.dropdown)
    end

    -- Stacks the rows top to bottom; the off-spec row only takes space when enabled.
    function controls.Layout()
        place(controls.primaryRow, top)
        local y = top - 32
        controls.offSpecCheck:ClearAllPoints()
        controls.offSpecCheck:SetPoint("TOPLEFT", 20, y)
        local showOffSpec = controls.offSpecCheck:GetChecked() and true or false
        controls.offSpecRow.label:SetShown(showOffSpec)
        controls.offSpecRow.dropdown:SetShown(showOffSpec)
        if showOffSpec then
            y = y - 30
            place(controls.offSpecRow, y)
            y = y - 8
        end
        y = y - 33
        place(controls.mainRow, y)
        if controls.removeRow then
            y = y - 41
            place(controls.removeRow, y)
        end
        if options.onLayout then
            options.onLayout(y - 41)
        end
    end

    -- Re-reads the logged-in character's saved profile into every control.
    function controls.Refresh()
        local profile = ns.GetProfile()
        if not profile then
            return
        end
        local role = profile.role
        UIDropDownMenu_SetText(controls.primaryRow.dropdown, ROLE_LABELS[role.primaryRole] or role.primaryRole)
        UIDropDownMenu_SetText(controls.offSpecRow.dropdown,
            role.offSpecRole and ROLE_LABELS[role.offSpecRole] or "Select")
        UIDropDownMenu_SetText(controls.mainRow.dropdown, profile.mainCharacterName or selfMainLabel())
        if controls.removeRow then
            UIDropDownMenu_SetText(controls.removeRow.dropdown, "Select to remove")
        end
        controls.offSpecCheck:SetChecked(role.offSpecEnabled)
        controls.Layout()
    end

    return controls
end
