local addonName, ns = ...

-- Reads the saved-instance list; call RequestRaidInfo() first to refresh server data.
function ns.ScanLockouts()
    local now = GetServerTime()
    local lockouts = {}
    for i = 1, GetNumSavedInstances() do
        local name, id, reset, difficulty, locked, extended, _, isRaid,
            _, _, numEncounters, encounterProgress = GetSavedInstanceInfo(i)
        if name and (locked or extended) and (reset or 0) > 0 and isRaid ~= false then
            lockouts[#lockouts + 1] = {
                instanceName = name,
                instanceId = id or name,
                difficultyId = difficulty,
                resetAt = now + reset,
                locked = locked and true or false,
                extended = extended and true or false,
                numEncounters = numEncounters or 0,
                completedEncounters = encounterProgress or 0,
            }
        end
    end
    return { updatedAt = now, lockouts = lockouts }
end

function ns.RequestLockouts()
    if RequestRaidInfo then
        RequestRaidInfo()
    end
end
