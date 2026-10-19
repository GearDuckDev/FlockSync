local addonName, ns = ...

-- Officer-side cleanup: characters unseen for 30+ days are marked inactive so
-- they drop out of the web Team Builder. They are tracked separately in
-- FlockSyncDB.staleCharacters (the character schema is strict) so the next
-- fresh login revives them, unlike sticky manual culls from the web.
local STALE_AFTER_SECONDS = 30 * 24 * 60 * 60
local LOGIN_DELAY = 5

function ns.IsStaleEpoch(lastSeenAt, now)
    return type(lastSeenAt) == "number"
        and lastSeenAt < (now or GetServerTime()) - STALE_AFTER_SECONDS
end

function ns.MarkStaleCharacters(now)
    now = now or GetServerTime()
    local count = 0
    for guid, character in pairs(FlockSyncDB.characters) do
        if type(character) == "table" and character.isActive ~= false
            and ns.IsStaleEpoch(character.lastSeenAt, now) then
            character.isActive = false
            FlockSyncDB.staleCharacters[guid] = true
            count = count + 1
        end
    end
    if count > 0 then
        FlockSyncDB.exportedAt = now
    end
    return count
end

-- Called from MergeCharacter before lastSeenAt is overwritten.
function ns.ReviveStaleCharacter(existing, incoming)
    local guid = incoming.guid
    if not FlockSyncDB.staleCharacters[guid] or incoming.isActive == false
        or incoming.lastSeenAt <= (existing.lastSeenAt or 0)
        or ns.IsStaleEpoch(incoming.lastSeenAt) then
        return
    end
    existing.isActive = true
    FlockSyncDB.staleCharacters[guid] = nil
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
    -- Guild rank info is not reliable until shortly after login.
    C_Timer.After(LOGIN_DELAY, function()
        if not ns.IsPlayerOfficer() then
            return
        end
        local count = ns.MarkStaleCharacters()
        if count > 0 then
            print(string.format(
                "|cff00c0ffFlockSync:|r marked %d character(s) inactive (unseen for 30+ days).",
                count))
        end
    end)
end)
