local addonName, ns = ...

local responding = false
local activeGuild

local function wire(entry)
    return {
        name = entry.name, realm = entry.realm, note = entry.note, author = entry.author,
        authorGuid = entry.authorGuid, actorGuid = entry.actorGuid,
        createdAt = entry.createdAt, updatedAt = entry.updatedAt, deleted = entry.deleted == true,
    }
end

function ns.SendKillEntry(entry, snapshot)
    return ns.SendKillMessage(snapshot and "SNAP" or "UPDATE", wire(entry))
end

function ns.PublishKillDraft(item)
    if not ns.IsOnboarded() or not ns.KillListEnabled() or item.destination ~= "shared" then
        print("FlockSync: Enable Kill List and choose a shared draft first.")
        return false
    end
    local store = ns.KillStore("shared")
    local entry = store and store[item.key]
    if not entry or entry ~= item.entry or entry.deleted or entry.sharedLive then
        print("FlockSync: This shared draft is no longer available.")
        return false
    end
    local member = ns.KillGuildMember(ns.GetPlayerFullName())
    if not member or (not member.officer and entry.authorGuid ~= member.guid) then
        print("FlockSync: Guild roster unavailable, or only the creator/guild officer can publish this draft.")
        return false
    end
    -- Publishing creates the live record now; offline drafts never masquerade as old guild events.
    local now = GetServerTime()
    if now <= entry.updatedAt then
        print("FlockSync: Draft just changed. Wait one second before publishing.")
        return false
    end
    local published = wire(entry)
    published.actorGuid = member.guid
    published.createdAt, published.updatedAt = now, now
    local ok, message = ns.SendKillEntry(published)
    if not ok then print("FlockSync: " .. message); return false end
    published.sharedLive = true
    store[item.key] = published
    ns.KillListChanged()
    print("FlockSync: Shared target queued for guild delivery. Keep the client online while it sends.")
    return true
end

function ns.RespondKillSync()
    if responding or not ns.IsOnboarded() then return end
    local store, guild = ns.KillStore("shared"), ns.KillGuildKey()
    local member = ns.KillGuildMember(ns.GetPlayerFullName())
    if not store or not member then return end
    responding = true
    local key, retry = nil, 0
    local function step()
        if guild ~= ns.KillGuildKey() or store ~= ns.KillStore("shared") then responding = false; return end
        local entry
        repeat
            key, entry = next(store, key)
        until not key or (entry.sharedLive and (member.officer
            or (entry.actorGuid == member.guid and entry.authorGuid == member.guid
                and (entry.deleted or entry.createdAt == entry.updatedAt))))
        if not key then
            responding = false
            if ns.RespondKillObservations then ns.RespondKillObservations() end
            return
        end
        local function deliver()
            if guild ~= ns.KillGuildKey() or store ~= ns.KillStore("shared") then responding = false; return end
            local currentMember = ns.KillGuildMember(ns.GetPlayerFullName())
            if not currentMember or currentMember.officer ~= member.officer then responding = false; return end
            local current = store[key]
            local ok, message = ns.SendKillEntry(current, member.officer)
            if not ok then
                retry = retry + 1
                if retry > 10 then
                    responding = false
                    print("FlockSync: Guild catch-up incomplete: " .. message .. " Request /fs kill sync again.")
                    return
                end
                C_Timer.After(15, deliver)
                return
            end
            retry = 0
            C_Timer.After(12, step)
        end
        deliver()
    end
    step()
end

function ns.StartKillSync()
    ns.RequestGuildRoster()
    C_Timer.After(15, function()
        if ns.IsOnboarded() and ns.KillGuildKey() then
            ns.RequestKillSync()
            ns.RespondKillSync()
        end
    end)
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_GUILD_UPDATE")
frame:SetScript("OnEvent", function(_, event)
    local guild = ns.KillGuildKey()
    if guild ~= activeGuild then
        ns.ResetKillTransport()
        activeGuild = guild
    end
    if event == "PLAYER_LOGIN" or guild then ns.StartKillSync() end
end)
