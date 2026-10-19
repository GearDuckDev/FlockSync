local addonName, ns = ...

ns.DAYS = { "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN" }
ns.STATUSES = { "REGULAR", "OCCASIONAL", "UNAVAILABLE" }
ns.TIMEZONES = { "EST", "CST", "MST", "PST", "UTC", "GMT", "CET", "AEST" }

local function defaultAvailability()
    local days = {}
    for _, day in ipairs(ns.DAYS) do
        days[day] = "UNAVAILABLE"
    end
    return {
        timezone = "EST",
        startTime = "19:00",
        endTime = "23:00",
        days = days,
        updatedAt = 0,
    }
end

-- Availability belongs to the human player, so it lives account-wide.
function ns.GetAccountAvailability()
    local availability = FlockSyncDB.accountAvailability
    if type(availability) ~= "table" then
        availability = defaultAvailability()
        FlockSyncDB.accountAvailability = availability
    end
    if type(availability.days) ~= "table" then
        availability.days = defaultAvailability().days
    end
    return availability
end

-- Returns nil until the player has configured it, so defaults never overwrite real data.
function ns.BuildAvailabilityPayload()
    local availability = ns.GetAccountAvailability()
    if (availability.updatedAt or 0) <= 0 then
        return nil
    end
    local schedule = {}
    for _, day in ipairs(ns.DAYS) do
        schedule[#schedule + 1] = {
            day = day,
            status = availability.days[day] or "UNAVAILABLE",
            startTime = availability.startTime,
            endTime = availability.endTime,
        }
    end
    return {
        timezone = availability.timezone,
        schedule = schedule,
        updatedAt = availability.updatedAt,
    }
end
