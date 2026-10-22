local addonName, ns = ...

function ns.ScanPlayer(preserveGear)
    if not ns.IsOnboarded() then
        return nil
    end
    local guid = UnitGUID("player")
    local name = ns.GetPlayerFullName()
    local realm = GetRealmName()
    local _, _, classId = UnitClass("player")
    if not guid or not name or not realm or not classId then
        return nil
    end

    local timestamp = GetServerTime()
    local profile = ns.GetProfile()
    ns.RegisterAccountCharacter()
    if not preserveGear then
        local items = {}
        local complete = true
        for slotId = 1, 19 do
            local itemLink = GetInventoryItemLink("player", slotId)
            local itemId = GetInventoryItemID("player", slotId)
            local texture = GetInventoryItemTexture("player", slotId)
            if itemLink and itemId then
                items[#items + 1] = {
                    slotId = slotId,
                    itemId = itemId,
                    itemLink = itemLink,
                }
            elseif itemLink or itemId or texture then
                complete = false
            end
        end
        -- An unavailable inventory during a transition is not an unequip.
        -- Explicit equipment events capture removal of the final item.
        if complete and (#items > 0 or #profile.gear.items == 0) then
            profile.gear = { updatedAt = timestamp, items = items }
        end
    end

    local character = {
        guid = guid,
        name = name,
        realm = realm,
        classId = classId,
        level = UnitLevel("player"),
        mainCharacterGuid = profile.mainCharacterGuid,
        mainCharacterName = profile.mainCharacterName,
        isActive = true,
        lastSeenAt = timestamp,
        role = {
            primaryRole = profile.role.primaryRole,
            offSpecEnabled = profile.role.offSpecEnabled,
            offSpecRole = profile.role.offSpecRole,
            updatedAt = profile.role.updatedAt,
        },
        gear = profile.gear,
        availability = ns.BuildAvailabilityPayload(),
        lockouts = ns.ScanLockouts(),
        professions = ns.BuildProfessionsPayload(),
        gearGoals = ns.BuildGearGoalsPayload(),
        attunements = ns.ScanAttunements(),
    }
    FlockSyncDB.officerCharacter = ns.FormatCharacterLabel(name, realm)
    local guildName = IsInGuild() and GetGuildInfo("player") or nil
    FlockSyncDB.collectorGuild = type(guildName) == "string" and guildName ~= ""
        and { name = guildName, realm = realm } or nil
    return character
end

function ns.CaptureEquipmentChange(slotId, hasItem)
    if not ns.IsOnboarded() or type(slotId) ~= "number" or slotId < 1 or slotId > 19 then
        return
    end
    local profile = ns.GetProfile()
    local replacement
    if hasItem then
        local itemLink = GetInventoryItemLink("player", slotId)
        local itemId = GetInventoryItemID("player", slotId)
        if not itemLink or not itemId then
            return
        end
        replacement = { slotId = slotId, itemId = itemId, itemLink = itemLink }
    elseif hasItem ~= false then
        return
    end
    local items = {}
    for _, item in ipairs(profile.gear.items) do
        if item.slotId ~= slotId then
            items[#items + 1] = item
        end
    end
    if replacement then
        items[#items + 1] = replacement
    end
    profile.gear = { updatedAt = GetServerTime(), items = items }
end
