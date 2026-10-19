local addonName, ns = ...

local ROW_HEIGHT = 22

local function crafterLabel(entry)
    local name = ns.ClassColoredName(entry.characterName, entry.classId)
    if ns.FindOnlineGuildmate(entry.characterGuid, entry.characterName) then
        name = name .. " |cff00ff00(online)|r"
    end
    return name
end

local function resolve(entry)
    local name, link, icon, isItem = ns.ResolveRecipeOutput(entry.itemIdOrSpellId)
    return {
        entry = entry,
        name = name,
        link = link,
        icon = icon,
        isItem = isItem,
        sortName = name or ("~" .. entry.itemIdOrSpellId),
    }
end

local function matches(result, query)
    if query == "" then
        return true
    end
    local entry = result.entry
    return (result.name and result.name:lower():find(query, 1, true))
        or entry.characterName:lower():find(query, 1, true)
        or (entry.mainCharacterName and entry.mainCharacterName:lower():find(query, 1, true))
        or tostring(entry.itemIdOrSpellId) == query
end

local function search(query)
    local results = {}
    for _, entry in ipairs(ns.Snapshot.craftersIndex) do
        local result = resolve(entry)
        if matches(result, query) then
            results[#results + 1] = result
        end
    end
    table.sort(results, function(a, b)
        if a.sortName ~= b.sortName then
            return a.sortName < b.sortName
        end
        return a.entry.characterName < b.entry.characterName
    end)
    return results
end

local function createRow(parent)
    local row = CreateFrame("Button", nil, parent)
    row:SetHighlightTexture("Interface\\QuestFrame\\UI-QuestTitleHighlight")
    row.icon = row:CreateTexture(nil, "ARTWORK")
    row.icon:SetSize(18, 18)
    row.icon:SetPoint("LEFT", 2, 0)
    row.name = ns.AddPanelText(row, "GameFontHighlightSmall", 150)
    row.name:SetPoint("LEFT", row.icon, "RIGHT", 6, 0)
    row.name:SetWordWrap(false)
    row.crafter = ns.AddPanelText(row, "GameFontHighlightSmall", 130)
    row.crafter:SetPoint("LEFT", 182, 0)
    row.crafter:SetWordWrap(false)
    row.whisper = ns.AddPanelButton(row, "Whisper", 64, function(self)
        local result = self:GetParent().item
        if result then
            local entry = result.entry
            local target = ns.FindOnlineGuildmate(entry.characterGuid, entry.characterName)
                or entry.characterName
            ns.WhisperCharacter(target, "Hey, can you craft " .. (result.link or result.name or ""))
        end
    end)
    row.whisper:SetPoint("RIGHT", -2, 0)
    row:SetScript("OnEnter", function(self)
        local result = self.item
        if not result then return end
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        if result.isItem then
            GameTooltip:SetHyperlink("item:" .. result.entry.itemIdOrSpellId)
        elseif GameTooltip.SetSpellByID then
            GameTooltip:SetSpellByID(result.entry.itemIdOrSpellId)
        end
        GameTooltip:Show()
    end)
    row:SetScript("OnLeave", GameTooltip_Hide)
    return row
end

local function bindRow(row, result)
    row.icon:SetTexture(result.icon or 134400)
    row.name:SetText(result.name or ("Loading... #" .. result.entry.itemIdOrSpellId))
    row.crafter:SetText(crafterLabel(result.entry))
end

function ns.BuildCrafterSearchPanel(parent)
    local panel = CreateFrame("Frame", nil, parent)
    panel:SetAllPoints(parent)

    local label = ns.AddPanelText(panel, "GameFontNormal")
    label:SetPoint("TOPLEFT", 18, -6)
    label:SetText("Search item, enchant, or crafter")
    panel.search = CreateFrame("EditBox", nil, panel, "InputBoxTemplate")
    panel.search:SetSize(240, 20)
    panel.search:SetPoint("TOPLEFT", 24, -24)
    panel.search:SetAutoFocus(false)
    panel.search:SetScript("OnEscapePressed", panel.search.ClearFocus)
    panel.search:SetScript("OnEnterPressed", panel.search.ClearFocus)
    panel.count = ns.AddPanelText(panel, "GameFontDisableSmall", 150)
    panel.count:SetPoint("TOPLEFT", 276, -28)

    panel.list = ns.CreateScrollList(panel, {
        top = -52, bottom = 14, rowHeight = ROW_HEIGHT, rowCount = 14,
        createRow = createRow, bindRow = bindRow,
    })
    panel.empty = ns.AddPanelText(panel, "GameFontHighlightSmall", 400)
    panel.empty:SetPoint("TOPLEFT", 20, -60)

    function panel.Refresh()
        local query = panel.search:GetText():lower():gsub("^%s+", ""):gsub("%s+$", "")
        local results = search(query)
        panel.count:SetText(#results .. " match(es)")
        panel.empty:SetShown(#results == 0)
        panel.empty:SetText(ns.HasSnapshot() and "No guild crafters match. Crafters must tick \"Accepting Guild Crafting Requests\"."
            or ns.DescribeSnapshot())
        panel.list.SetItems(results)
    end

    local generation = 0
    local function refreshSoon()
        generation = generation + 1
        local current = generation
        C_Timer.After(0.2, function()
            if current == generation and panel:IsVisible() then
                panel.Refresh()
            end
        end)
    end
    panel.search:SetScript("OnTextChanged", refreshSoon)
    ns.OnSnapshotChanged(refreshSoon)
    ns.OnGuildRosterChanged(refreshSoon)
    -- Item names arrive asynchronously after the first lookup.
    panel:RegisterEvent("GET_ITEM_INFO_RECEIVED")
    panel:SetScript("OnEvent", refreshSoon)
    panel:SetScript("OnShow", ns.RequestGuildRoster)
    ns.RequestGuildRoster()
    return panel
end
