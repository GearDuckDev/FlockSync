local addonName, ns = ...

local MAX_ITEMS = 2000
local FULL_SCAN_COOLDOWN = 5
local count = 0
local loaded = false
local lastFullScanAt = -1
local items = {}
local order = {}

local function evictOldest()
    while count >= MAX_ITEMS and #order > 0 do
        local oldestId = table.remove(order, 1)
        if items[oldestId] then
            items[oldestId] = nil
            if type(FlockSyncDB.itemSearchCache) == "table" then
                FlockSyncDB.itemSearchCache[tostring(oldestId)] = nil
            end
            count = count - 1
        end
    end
end

local function storeInMemory(itemId, name, link, refreshRecent)
    if type(itemId) ~= "number" or itemId <= 0 or type(name) ~= "string"
        or name == "" then
        return false
    end
    if not items[itemId] then
        evictOldest()
        count = count + 1
        order[#order + 1] = itemId
    elseif refreshRecent and order[#order] ~= itemId then
        for index, id in ipairs(order) do
            if id == itemId then
                table.remove(order, index)
                break
            end
        end
        order[#order + 1] = itemId
    end
    items[itemId] = { itemId = itemId, name = name, link = link, search = name:lower() }
    return true
end

local function remember(itemId, name, link, refreshRecent)
    if storeInMemory(itemId, name, link, refreshRecent) then
        FlockSyncDB.itemSearchCache[tostring(itemId)] = { name = name, link = link }
    end
end

local function loadCache()
    if loaded and type(FlockSyncDB) == "table"
        and type(FlockSyncDB.itemSearchCache) == "table" then
        return
    end
    loaded = true
    count = 0
    items = {}
    order = {}
    lastFullScanAt = -1
    if type(FlockSyncDB.itemSearchCache) ~= "table" then
        FlockSyncDB.itemSearchCache = {}
        return
    end
    local snapshot = {}
    for key, item in pairs(FlockSyncDB.itemSearchCache) do
        local id = tonumber(key)
        if id and id > 0 and type(item) == "table" and type(item.name) == "string"
            and item.name ~= "" then
            snapshot[#snapshot + 1] = { id = id, name = item.name, link = item.link }
        end
    end
    table.sort(snapshot, function(a, b) return a.id < b.id end)
    FlockSyncDB.itemSearchCache = {}
    for _, entry in ipairs(snapshot) do
        remember(entry.id, entry.name, entry.link, false)
    end
end

local function rememberLink(link, refreshRecent)
    if type(link) ~= "string" then return end
    local itemId = ns.ParseItemInput(link)
    if not itemId then return end
    if items[itemId] and not refreshRecent then
        return
    end
    local name = link:match("|h%[(.-)%]|h")
    if name and name ~= "" then
        remember(itemId, name, link, refreshRecent)
    end
end

local function collectCharacter(character, refreshRecent)
    if type(character) ~= "table" then return end
    local gear = character.gear or {}
    for _, item in ipairs(gear.items or {}) do
        rememberLink(item.itemLink, refreshRecent)
    end
    local goals = character.gearGoals or {}
    for _, goal in ipairs(goals.goals or {}) do
        rememberLink(goal.itemLink, refreshRecent)
    end
end

-- Index only encountered links; never enumerate IDs or query the whole item DB.
function ns.RefreshItemSearch(forceFull)
    loadCache()
    local now = GetServerTime and GetServerTime() or 0
    if forceFull or lastFullScanAt < 0 or (now - lastFullScanAt) >= FULL_SCAN_COOLDOWN then
        lastFullScanAt = now
        for _, character in pairs(FlockSyncDB.characters or {}) do
            collectCharacter(character, false)
        end
        local ledger = FlockSyncDB.guildLedger or {}
        for _, loot in ipairs(ledger.loot or {}) do
            rememberLink(loot.itemLink, false)
        end
        for _, profile in pairs(FlockSyncDB.profiles or {}) do
            collectCharacter(profile, true)
        end
    end
    for slot = 1, 19 do
        rememberLink(GetInventoryItemLink("player", slot), true)
    end
    if C_Container and C_Container.GetContainerNumSlots
        and C_Container.GetContainerItemLink then
        for bag = 0, 4 do
            for slot = 1, C_Container.GetContainerNumSlots(bag) do
                rememberLink(C_Container.GetContainerItemLink(bag, slot), true)
            end
        end
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
