local addonName, ns = ...

-- Virtual list: a fixed pool of rows re-bound to items as the user scrolls.
-- Built from plain frames so no named (global) template children are created.
-- options: top, bottom, rowHeight, rowCount, createRow(parent), bindRow(row, item)
function ns.CreateScrollList(parent, options)
    local list = CreateFrame("Frame", nil, parent)
    list:SetPoint("TOPLEFT", 14, options.top)
    list:SetPoint("BOTTOMRIGHT", -14, options.bottom)
    list.items = {}
    list.rows = {}
    local offset = 0

    local slider = CreateFrame("Slider", nil, list)
    slider:SetOrientation("VERTICAL")
    slider:SetPoint("TOPRIGHT", 0, 0)
    slider:SetPoint("BOTTOMRIGHT", 0, 0)
    slider:SetWidth(14)
    slider:SetThumbTexture("Interface\\Buttons\\UI-ScrollBar-Knob")
    slider:GetThumbTexture():SetSize(18, 24)
    slider.track = slider:CreateTexture(nil, "BACKGROUND")
    slider.track:SetAllPoints()
    slider.track:SetColorTexture(0, 0, 0, 0.35)
    slider:SetMinMaxValues(0, 0)
    slider:SetValueStep(1)
    if slider.SetObeyStepOnDrag then
        slider:SetObeyStepOnDrag(true)
    end

    for index = 1, options.rowCount do
        local row = options.createRow(list)
        row:SetPoint("TOPLEFT", 0, -(index - 1) * options.rowHeight)
        row:SetPoint("RIGHT", slider, "LEFT", -4, 0)
        row:SetHeight(options.rowHeight)
        row:Hide()
        list.rows[index] = row
    end

    function list.Render()
        for index, row in ipairs(list.rows) do
            local item = list.items[offset + index]
            row.item = item
            if item then
                options.bindRow(row, item)
                row:Show()
            else
                row:Hide()
            end
        end
    end

    local function maxOffset()
        return math.max(0, #list.items - options.rowCount)
    end

    slider:SetScript("OnValueChanged", function(_, value)
        offset = math.min(maxOffset(), math.max(0, math.floor(value + 0.5)))
        list.Render()
    end)
    list:EnableMouseWheel(true)
    list:SetScript("OnMouseWheel", function(_, delta)
        slider:SetValue(slider:GetValue() - delta)
    end)

    function list.SetItems(items)
        list.items = items
        slider:SetMinMaxValues(0, maxOffset())
        slider:SetShown(maxOffset() > 0)
        if offset > maxOffset() then
            offset = maxOffset()
            slider:SetValue(offset)
        end
        list.Render()
    end
    return list
end

-- Small helpers shared by the snapshot tabs.
function ns.AddPanelText(parent, template, width)
    local text = parent:CreateFontString(nil, "OVERLAY", template or "GameFontHighlightSmall")
    text:SetJustifyH("LEFT")
    if width then
        text:SetWidth(width)
    end
    return text
end

function ns.AddPanelButton(parent, label, width, onClick)
    local button = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
    button:SetSize(width, 20)
    button:SetText(label)
    button:SetScript("OnClick", onClick)
    return button
end

local recipeCache = {}
local requestedItems = {}

local function getSpellDetails(id)
    if C_Spell and C_Spell.GetSpellInfo then
        local info = C_Spell.GetSpellInfo(id)
        if info and info.name then
            return info.name, info.iconID
        end
    end
    if GetSpellInfo then
        local name, _, icon = GetSpellInfo(id)
        if name then
            return name, icon
        end
    end
    return nil, nil
end

-- Item names load asynchronously; spell ids (enchants) have no item record,
-- though their numeric IDs can overlap with unrelated items in the game DB.
function ns.ResolveRecipeOutput(id)
    local cached = recipeCache[id]
    if cached then
        return cached.name, cached.link, cached.icon, cached.isItem
    end
    local spellName, spellIcon = getSpellDetails(id)
    if spellName and spellName:match("^[Ee]nchant ") then
        local spellLink = (C_Spell and C_Spell.GetSpellLink and C_Spell.GetSpellLink(id))
            or (GetSpellLink and GetSpellLink(id)) or nil
        recipeCache[id] = { name = spellName, link = spellLink, icon = spellIcon, isItem = false }
        return spellName, spellLink, spellIcon, false
    end
    local getInstant = C_Item and C_Item.GetItemInfoInstant or GetItemInfoInstant
    local getInfo = C_Item and C_Item.GetItemInfo or GetItemInfo
    if getInstant and getInstant(id) then
        local name, link, _, _, _, _, _, _, _, icon = getInfo(id)
        if name then
            local resolvedIcon = icon or select(5, getInstant(id))
            recipeCache[id] = { name = name, link = link, icon = resolvedIcon, isItem = true }
            return name, link, resolvedIcon, true
        end
        if not requestedItems[id] and C_Item and C_Item.RequestLoadItemDataByID then
            requestedItems[id] = true
            C_Item.RequestLoadItemDataByID(id)
        end
        return nil, nil, select(5, getInstant(id)), true
    end
    if spellName then
        recipeCache[id] = { name = spellName, link = nil, icon = spellIcon, isItem = false }
        return spellName, nil, spellIcon, false
    end
    return nil, nil, nil, false
end
