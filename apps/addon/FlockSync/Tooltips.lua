local addonName, ns = ...

local MAX_NAMES = 4

-- Joins unique names, collapsing the overflow into "+N more".
local function nameList(entries)
    local names, seen = {}, {}
    for _, entry in ipairs(entries) do
        local name = entry.characterName
        if not seen[name] then
            seen[name] = true
            names[#names + 1] = name
        end
    end
    local shown = {}
    for index = 1, math.min(#names, MAX_NAMES) do
        shown[index] = names[index]
    end
    local text = table.concat(shown, ", ")
    if #names > MAX_NAMES then
        text = text .. ", +" .. (#names - MAX_NAMES) .. " more"
    end
    return text, #names
end

local function appendSnapshotLines(tooltip, itemId)
    if type(itemId) ~= "number" or not tooltip or not tooltip.AddLine
        or not ns.IsEnabled("showTooltips") then
        return
    end
    local goals = ns.Snapshot.goalsByItem[itemId]
    if goals then
        local names, count = nameList(goals)
        tooltip:AddLine("|cff00ff00FlockSync Goal:|r Needed by " .. count
            .. (count == 1 and " guildmate" or " guildmates") .. " (" .. names .. ")",
            1, 1, 1, true)
    end
    local crafters = ns.Snapshot.craftersByItem[itemId]
    if crafters then
        tooltip:AddLine("|cff00c0ffFlockSync Crafter:|r " .. nameList(crafters)
            .. " (Accepting Requests)", 1, 1, 1, true)
    end
end

local function itemIdFromTooltip(tooltip)
    if not tooltip.GetItem then
        return nil
    end
    local _, link = tooltip:GetItem()
    return ns.ParseItemInput(link)
end

-- Interface 16001 ships the retail tooltip data pipeline; data.id is the item id.
if TooltipDataProcessor and TooltipDataProcessor.AddTooltipPostCall
    and Enum and Enum.TooltipDataType and Enum.TooltipDataType.Item then
    TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Item, function(tooltip, data)
        local itemId = type(data) == "table" and data.id or itemIdFromTooltip(tooltip)
        appendSnapshotLines(tooltip, itemId)
    end)
else
    for _, tooltip in ipairs({ GameTooltip, ItemRefTooltip, ShoppingTooltip1, ShoppingTooltip2 }) do
        if tooltip and tooltip.HookScript then
            tooltip:HookScript("OnTooltipSetItem", function(self)
                appendSnapshotLines(self, itemIdFromTooltip(self))
            end)
        end
    end
end
