local addonName, ns = ...

function ns.ScanPlayer()
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
    local items = {}
    for slotId = 1, 19 do
        local itemLink = GetInventoryItemLink("player", slotId)
        local itemId = GetInventoryItemID("player", slotId)
        if itemLink and itemId then
            items[#items + 1] = {
                slotId = slotId,
                itemId = itemId,
                itemLink = itemLink,
            }
        end
    end
    profile.gear = { updatedAt = timestamp, items = items }

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
        gear = { updatedAt = profile.gear.updatedAt, items = items },
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
