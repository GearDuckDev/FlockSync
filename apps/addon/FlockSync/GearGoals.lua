local addonName, ns = ...

ns.MAX_GEAR_GOALS = 5

function ns.GetGearGoals()
    local profile = ns.GetProfile()
    if type(profile.gearGoals) ~= "table" then
        profile.gearGoals = { updatedAt = 0, goals = {} }
    end
    if type(profile.gearGoals.goals) ~= "table" then
        profile.gearGoals.goals = {}
    end
    return profile.gearGoals
end

-- Accepts a dragged item's id/link, a shift-clicked link, or a bare item id.
function ns.ParseItemInput(text)
    if type(text) ~= "string" then
        return nil
    end
    local id = text:match("item:(%d+)") or text:match("^%s*(%d+)%s*$")
    return id and tonumber(id) or nil
end

local function itemInfo(itemId)
    local getInfo = C_Item and C_Item.GetItemInfo or GetItemInfo
    local name, link, _, _, _, _, _, _, _, icon = getInfo(itemId)
    return name, link, icon
end

function ns.GetGoalItemInfo(itemId)
    return itemInfo(itemId)
end

-- Stores a goal; index is clamped so the list stays contiguous.
function ns.SetGearGoal(index, itemId, itemLink)
    local store = ns.GetGearGoals()
    index = math.min(index, #store.goals + 1)
    if index > ns.MAX_GEAR_GOALS then
        return false
    end
    local _, link = itemInfo(itemId)
    local previous = store.goals[index]
    store.goals[index] = {
        itemId = itemId,
        itemLink = itemLink or link or ("item:" .. itemId),
        note = previous and previous.itemId == itemId and previous.note or nil,
    }
    store.updatedAt = GetServerTime()
    return true
end

function ns.SetGearGoalNote(index, note)
    local store = ns.GetGearGoals()
    local goal = store.goals[index]
    if not goal then
        return false
    end
    note = (note or ""):gsub("^%s+", ""):gsub("%s+$", "")
    goal.note = note ~= "" and note:sub(1, 80) or nil
    store.updatedAt = GetServerTime()
    return true
end

function ns.ClearGearGoal(index)
    local store = ns.GetGearGoals()
    if store.goals[index] then
        table.remove(store.goals, index)
        store.updatedAt = GetServerTime()
    end
end

-- Returns nil until the player has set a goal at least once.
function ns.BuildGearGoalsPayload()
    local store = ns.GetGearGoals()
    if (store.updatedAt or 0) <= 0 then
        return nil
    end
    return { goals = store.goals, updatedAt = store.updatedAt }
end
