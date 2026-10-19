local addonName, ns = ...

-- Recipe ids are item ids for crafted items and spell ids for enchants (which
-- have no item); the web dashboard picks the right Wowhead link by profession.
local function recipeIdFromLink(link)
    if type(link) ~= "string" then
        return nil
    end
    local id = link:match("item:(%d+)") or link:match("enchant:(%d+)")
        or link:match("spell:(%d+)")
    return id and tonumber(id) or nil
end

local function getStore(profile)
    if type(profile.professions) ~= "table" then
        profile.professions = { updatedAt = 0, list = {} }
    end
    if type(profile.professions.list) ~= "table" then
        profile.professions.list = {}
    end
    return profile.professions
end

-- Recipe lists only show what the open window displays (collapsed headers or
-- filters hide entries), so scans are merged into what was captured before.
local function mergeProfession(store, name, level, maxLevel, recipeIds)
    local entry = store.list[name]
    if type(entry) ~= "table" then
        entry = { name = name, recipes = {} }
        store.list[name] = entry
    end
    entry.level = level
    entry.maxLevel = maxLevel
    local known = {}
    for _, id in ipairs(entry.recipes) do
        known[id] = true
    end
    for _, id in ipairs(recipeIds) do
        if not known[id] then
            known[id] = true
            entry.recipes[#entry.recipes + 1] = id
        end
    end
    table.sort(entry.recipes)
    store.updatedAt = GetServerTime()
end

local function collect(count, infoFn, linkFn)
    local ids = {}
    for index = 1, count do
        local _, kind = infoFn(index)
        if kind ~= "header" and kind ~= "subheader" then
            local id = recipeIdFromLink(linkFn(index))
            if id then
                ids[#ids + 1] = id
            end
        end
    end
    return ids
end

-- Newer clients (and WoW Forever) use C_TradeSkillUI instead of the classic globals.
local function scanModernTradeSkill()
    local api = C_TradeSkillUI
    if not (api and api.GetAllRecipeIDs and api.GetRecipeInfo) then
        return nil
    end
    -- Never record another player's linked profession or an NPC trainer window.
    if (api.IsTradeSkillLinked and api.IsTradeSkillLinked())
        or (api.IsNPCCrafting and api.IsNPCCrafting()) then
        return nil
    end
    local base = api.GetBaseProfessionInfo and api.GetBaseProfessionInfo() or nil
    local name = base and (base.professionName or base.parentProfessionName)
    if not name or name == "" then
        return nil
    end
    local ids = {}
    for _, recipeId in ipairs(api.GetAllRecipeIDs() or {}) do
        local info = api.GetRecipeInfo(recipeId)
        if info and info.learned then
            local output = api.GetRecipeOutputItemData and api.GetRecipeOutputItemData(recipeId)
            ids[#ids + 1] = output and output.itemID or recipeId
        end
    end
    return name, base.skillLevel or 0, base.maxSkillLevel or 0, ids
end

local function scanTradeSkill()
    local name, level, maxLevel, ids = scanModernTradeSkill()
    if name then
        return name, level, maxLevel, ids
    end
    if not (GetTradeSkillLine and GetNumTradeSkills) then
        return nil
    end
    local name, level, maxLevel = GetTradeSkillLine()
    if not name or name == "UNKNOWN" or name == "" then
        return nil
    end
    local ids = collect(GetNumTradeSkills(), GetTradeSkillInfo, function(index)
        return (GetTradeSkillItemLink and GetTradeSkillItemLink(index))
            or (GetTradeSkillRecipeLink and GetTradeSkillRecipeLink(index))
    end)
    return name, level or 0, maxLevel or 0, ids
end

-- Classic Enchanting uses the Craft window instead of the trade skill window.
local function scanCraft()
    if not (GetCraftDisplaySkillLine and GetNumCrafts) then
        return nil
    end
    local name, level, maxLevel = GetCraftDisplaySkillLine()
    if not name or name == "" then
        name = GetCraftName and GetCraftName() or nil
        level, maxLevel = 0, 0
    end
    if not name or name == "" then
        return nil
    end
    local ids = collect(GetNumCrafts(), function(index)
        local craftName, _, craftType = GetCraftInfo(index)
        return craftName, craftType
    end, function(index)
        return GetCraftItemLink and GetCraftItemLink(index)
    end)
    return name, level or 0, maxLevel or 0, ids
end

-- Returns true when a profession window was read and stored.
function ns.ScanProfessions(source)
    local profile = ns.GetProfile()
    if not profile then
        return false
    end
    local name, level, maxLevel, ids
    if source == "craft" then
        name, level, maxLevel, ids = scanCraft()
    else
        name, level, maxLevel, ids = scanTradeSkill()
    end
    if not name then
        return false
    end
    mergeProfession(getStore(profile), name, level, maxLevel, ids)
    return true
end

function ns.SetAcceptingRequests(value)
    local profile = ns.GetProfile()
    profile.acceptingRequests = value and true or false
    getStore(profile).updatedAt = GetServerTime()
end

function ns.ProfessionSummary()
    local profile = ns.GetProfile()
    local lines = {}
    for _, entry in pairs(getStore(profile).list) do
        lines[#lines + 1] = string.format("%s %d/%d (%d recipes)",
            entry.name, entry.level or 0, entry.maxLevel or 0, #entry.recipes)
    end
    table.sort(lines)
    if #lines == 0 then
        return "No professions scanned yet. Open each profession window once."
    end
    return table.concat(lines, "\n")
end

-- Returns nil until a profession has been scanned, so empty data never overwrites real data.
function ns.BuildProfessionsPayload()
    local profile = ns.GetProfile()
    local store = getStore(profile)
    local primary = {}
    for _, entry in pairs(store.list) do
        primary[#primary + 1] = {
            name = entry.name,
            level = entry.level or 0,
            maxLevel = entry.maxLevel or 0,
            recipes = entry.recipes,
            acceptingRequests = profile.acceptingRequests == true,
        }
    end
    if #primary == 0 then
        return nil
    end
    table.sort(primary, function(a, b) return a.name < b.name end)
    return { primary = primary, updatedAt = store.updatedAt }
end
