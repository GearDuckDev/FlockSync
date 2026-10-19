local addonName, ns = ...

local MAX_ITEMS = 2000
local count = 0
local loaded = false
local items = {}

local function remember(itemId, name, link)
    if type(itemId) ~= "number" or itemId <= 0 or type(name) ~= "string"
        or name == "" then
        return
    end
    if not items[itemId] then
        if count >= MAX_ITEMS then return end
        count = count + 1
    end
    items[itemId] = { itemId = itemId, name = name, link = link, search = name:lower() }
    FlockSyncDB.itemSearchCache[tostring(itemId)] = { name = name, link = link }
end

local function loadCache()
    if loaded then return end
    loaded = true
    if type(FlockSyncDB.itemSearchCache) ~= "table" then
        FlockSyncDB.itemSearchCache = {}
    end
    for key, item in pairs(FlockSyncDB.itemSearchCache) do
        if type(item) == "table" then
            remember(tonumber(key), item.name, item.link)
        end
    end
end

local function rememberLink(link)
    if type(link) ~= "string" then return end
    local itemId = ns.ParseItemInput(link)
    local name = link:match("|h%[(.-)%]|h")
    if itemId and name then
        remember(itemId, name, link)
    end
end

local function collectCharacter(character)
    if type(character) ~= "table" then return end
    local gear = character.gear or {}
    for _, item in ipairs(gear.items or {}) do
        rememberLink(item.itemLink)
    end
    local goals = character.gearGoals or {}
    for _, goal in ipairs(goals.goals or {}) do
        rememberLink(goal.itemLink)
    end
end

-- Index only encountered links; never enumerate IDs or query the whole item DB.
function ns.RefreshItemSearch()
    loadCache()
    for slot = 1, 19 do
        rememberLink(GetInventoryItemLink("player", slot))
    end
    if C_Container and C_Container.GetContainerNumSlots
        and C_Container.GetContainerItemLink then
        for bag = 0, 4 do
            for slot = 1, C_Container.GetContainerNumSlots(bag) do
                rememberLink(C_Container.GetContainerItemLink(bag, slot))
            end
        end
    end
    for _, character in pairs(FlockSyncDB.characters or {}) do
        collectCharacter(character)
    end
    for _, profile in pairs(FlockSyncDB.profiles or {}) do
        collectCharacter(profile)
    end
    local ledger = FlockSyncDB.guildLedger or {}
    for _, loot in ipairs(ledger.loot or {}) do
        rememberLink(loot.itemLink)
    end
end

function ns.FindGoalItems(query)
    loadCache()
    query = query:match("^%s*(.-)%s*$"):lower()
    if #query < 2 or ns.ParseItemInput(query) then return {} end
    local matches = {}
    for _, item in pairs(items) do
        if item.search:find(query, 1, true) then
            matches[#matches + 1] = item
        end
    end
    table.sort(matches, function(a, b)
        local aPrefix = a.search:sub(1, #query) == query
        local bPrefix = b.search:sub(1, #query) == query
        if aPrefix ~= bPrefix then return aPrefix end
        if a.search == b.search then return a.itemId < b.itemId end
        return a.search < b.search
    end)
    local result = {}
    for index = 1, math.min(6, #matches) do
        result[index] = matches[index]
    end
    return result
end
