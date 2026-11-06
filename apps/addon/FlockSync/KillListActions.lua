local addonName, ns = ...

local function fail(message)
    print("FlockSync: " .. message)
    return false, message
end
local function ready()
    return ns.IsOnboarded() and ns.KillListEnabled()
end
function ns.SaveKillTarget(name, realm, note, shared, personal)
    if not ready() then return fail("Complete setup and enable Kill List first.") end
    if type(shared) ~= "boolean" or type(personal) ~= "boolean" or not (shared or personal) then
        return fail("Select Shared, Personal, or both.")
    end
    local target, message = ns.ValidateKillTarget(name, realm, note)
    if not target then return fail(message) end
    if personal and not ns.GetKillState().personalEnabled then return fail("Enable your personal list first.") end
    local stores = {}
    if shared then
        local store = ns.KillStore("shared")
        if not store then return fail("Wait for your guild information before adding a guild-shared target.") end
        stores[#stores + 1] = store
    end
    if personal then stores[#stores + 1] = ns.KillStore("personal") end
    local key = string.lower(target.realm) .. "\031" .. string.lower(target.name)
    local now, guid, author = GetServerTime(), UnitGUID("player"), ns.GetPlayerFullName()
    if not guid or not author then return fail("Character identity unavailable.") end
    for _, store in ipairs(stores) do
        local old = store[key]
        if old and not old.deleted then return fail("Target already exists on a selected list; nothing saved.") end
        if old and now <= old.updatedAt then return fail("Target just changed. Wait one second and retry.") end
    end
    local published
    if shared then
        local member = ns.KillGuildMember(ns.GetPlayerFullName())
        if not member or member.guid ~= guid or target.realm ~= GetRealmName() then
            return fail("Current guild roster identity and matching realm are required to share; nothing saved. Retry when ready.")
        end
        published = { name = target.name, realm = target.realm, note = target.note,
            author = author, authorGuid = guid, actorGuid = guid, createdAt = now,
            updatedAt = now, deleted = false, sharedLive = true }
        local ok, errorMessage = ns.SendKillEntry(published)
        if not ok then return fail(errorMessage .. " Nothing saved; retry after the queue drains.") end
    end
    for _, store in ipairs(stores) do
        store[key] = { name = target.name, realm = target.realm, note = target.note,
            author = author, authorGuid = guid, createdAt = now, updatedAt = now }
    end
    if published then
        ns.KillStore("shared")[key] = published
        print("FlockSync: Target and note queued for guild delivery. Keep the client online while it sends.")
    end
    ns.KillListChanged()
    return true
end

function ns.ChangeKillTarget(item, note, removing)
    if not ready() then return fail("Complete setup and enable Kill List first.") end
    if item.destination == "personal" and not ns.GetKillState().personalEnabled then
        return fail("Enable your personal list first.")
    end
    local store = ns.KillStore(item.destination)
    local entry = store and store[item.key]
    if not entry or entry.deleted or entry ~= item.entry then return fail("Target changed or is no longer available.") end
    if not ns.CanChangeKill(item, removing) then return fail("A current online guild member is required to change shared targets.") end
    local target, message = ns.ValidateKillTarget(entry.name, entry.realm, note)
    if not target then return fail(message) end
    local now = GetServerTime()
    if now <= entry.updatedAt then return fail("Target just changed. Wait one second and retry.") end
    if item.destination == "shared" and entry.sharedLive then
        local member = ns.KillLiveMember()
        if not member then return fail("A current online guild member is required to change shared targets.") end
        local updated = {}
        for key, value in pairs(entry) do updated[key] = value end
        updated.actorGuid, updated.updatedAt = member.guid, now
        updated.note, updated.deleted = removing and "" or target.note, removing == true
        local ok, message = ns.SendKillEntry(updated)
        if not ok then return fail(message) end
        store[item.key] = updated
        ns.KillListChanged()
        return true
    end
    entry.updatedAt, entry.note, entry.deleted = now, removing and "" or target.note, removing == true
    ns.KillListChanged()
    return true
end
