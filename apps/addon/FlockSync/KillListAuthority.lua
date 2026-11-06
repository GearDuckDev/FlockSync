local addonName, ns = ...

function ns.KillGuildMember(sender)
    local normalized = ns.NormalizeCharacterName(sender)
    if not normalized or not ns.CurrentGuildName() then return nil end
    for index = 1, GetNumGuildMembers() do
        local name, _, rank, _, _, _, _, _, online, _, _, _, _, _, _, _, guid = GetGuildRosterInfo(index)
        if online and ns.NormalizeCharacterName(name) == normalized and type(guid) == "string" then
            return { name = name, guid = guid, officer = type(rank) == "number"
                and rank <= (FlockSyncDB.config.officerRankThreshold or 2) }
        end
    end
    return nil
end

function ns.KillLiveOfficer()
    local member = ns.KillGuildMember(ns.GetPlayerFullName())
    return member ~= nil and member.officer
end

function ns.KillLiveMember()
    local member = ns.KillGuildMember(ns.GetPlayerFullName())
    return member and member.guid == UnitGUID("player") and member or nil
end

local function epoch(value)
    return type(value) == "number" and value >= 0 and value % 1 == 0
        and value <= GetServerTime() + 30
end

function ns.ValidateKillWire(entry)
    if type(entry) ~= "table" or type(entry.name) ~= "string" or type(entry.realm) ~= "string"
        or type(entry.note) ~= "string" or type(entry.author) ~= "string"
        or type(entry.authorGuid) ~= "string" or #entry.authorGuid < 1 or #entry.authorGuid > 80
        or type(entry.actorGuid) ~= "string" or #entry.actorGuid < 1 or #entry.actorGuid > 80
        or not epoch(entry.createdAt) or not epoch(entry.updatedAt)
        or entry.createdAt > entry.updatedAt or type(entry.deleted) ~= "boolean" then return nil end
    if entry.updatedAt <= (FlockSyncDB.databaseResetAt or 0) then return nil end
    local target = ns.ValidateKillTarget(entry.name, entry.realm, entry.note)
    if not target or target.name ~= entry.name or target.realm ~= entry.realm
        or entry.realm ~= GetRealmName() or not ns.ValidateKillAuthor(entry.author) then return nil end
    if entry.deleted and entry.note ~= "" then return nil end
    return {
        name = entry.name, realm = entry.realm, note = entry.note, author = entry.author,
        authorGuid = entry.authorGuid, actorGuid = entry.actorGuid, createdAt = entry.createdAt,
        updatedAt = entry.updatedAt, deleted = entry.deleted, sharedLive = true,
    }
end

function ns.MergeKillWire(raw, member, snapshot)
    local entry = ns.ValidateKillWire(raw)
    if not entry or (snapshot and not member.officer) then return false end
    local key = entry.realm:lower() .. "\031" .. entry.name:lower()
    local store = ns.KillStore("shared")
    if not store then return false end
    local old = store[key]
    if old and not old.sharedLive then
        -- Drafts are deliberately not published or overwritten by incoming traffic.
        print("FlockSync: A guild target conflicts with a local draft: " .. ns.KillDisplayText(entry.name)
            .. ". Remove or publish the draft, then request /fs kill sync again.")
        return false
    end
    if old and entry.updatedAt <= old.updatedAt then
        if entry.updatedAt == old.updatedAt and (entry.deleted ~= old.deleted or entry.note ~= old.note
            or entry.authorGuid ~= old.authorGuid or entry.actorGuid ~= old.actorGuid) then
            print("FlockSync: Equal-time guild kill-list conflict; no overwrite. Retry the change next second.")
        end
        return false
    end
    if old and old.deleted and not entry.deleted
        and (entry.createdAt <= old.updatedAt or (not snapshot and entry.createdAt ~= entry.updatedAt)) then
        print("FlockSync: Removed target requires a new addition; ignored an old edit.")
        return false
    end
    if not snapshot and entry.actorGuid ~= member.guid then return false end
    if old and not old.deleted and (entry.authorGuid ~= old.authorGuid or entry.createdAt ~= old.createdAt) then
        if not snapshot or entry.createdAt <= old.updatedAt then return false end
    end
    store[key] = entry
    ns.KillListChanged()
    return true
end
