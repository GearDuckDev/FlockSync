local addonName, ns = ...

local MAX_NAMES = 4
local GOAL_PREFIX = "|cff00ff00FlockSync Goal:|r"
local CRAFTER_PREFIX = "|cff00c0ffFlockSync Crafter:|r"

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

local function alreadyAnnotated(tooltip, itemId)
    if tooltip.NumLines and tooltip.GetName then
        local base = tooltip:GetName()
        local total = tooltip:NumLines() or 0
        if base and total > 0 then
            for i = 1, total do
                local left = _G[base .. "TextLeft" .. i]
                local text = left and left.GetText and left:GetText()
                if type(text) == "string"
                    and (text:sub(1, #GOAL_PREFIX) == GOAL_PREFIX
                        or text:sub(1, #CRAFTER_PREFIX) == CRAFTER_PREFIX) then
                    return true
                end
            end
            return false
        end
    end
    return tooltip._flockSyncLastItemId == itemId
end

local function appendSnapshotLines(tooltip, itemId)
    if type(itemId) ~= "number" or not tooltip or not tooltip.AddLine
        or not ns.IsEnabled("showTooltips") or alreadyAnnotated(tooltip, itemId) then
        return
    end
    local goals = ns.Snapshot.goalsByItem[itemId]
    local crafters = ns.Snapshot.craftersByItem[itemId]
    if not goals and not crafters then
        return
    end
    tooltip._flockSyncLastItemId = itemId
    if goals then
        local names, count = nameList(goals)
        tooltip:AddLine(GOAL_PREFIX .. " Needed by " .. count
            .. (count == 1 and " guildmate" or " guildmates") .. " (" .. names .. ")",
            1, 1, 1, true)
    end
    if crafters then
        tooltip:AddLine(CRAFTER_PREFIX .. " " .. nameList(crafters)
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

for _, tooltip in ipairs({ GameTooltip, ItemRefTooltip, ShoppingTooltip1, ShoppingTooltip2 }) do
    if tooltip and tooltip.HookScript then
        pcall(tooltip.HookScript, tooltip, "OnTooltipCleared", function(self)
            self._flockSyncLastItemId = nil
        end)
    end
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
