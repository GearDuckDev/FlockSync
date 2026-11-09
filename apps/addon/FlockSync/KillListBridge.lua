local addonName, ns = ...

function ns.LoadServerKillList()
    local helper = FlockSyncHelperDB
    local guild = type(helper) == "table" and helper.authorizedCollectorGuild
    if type(guild) ~= "table" or helper.isAuthorizedOfficer ~= true
        or guild.name ~= ns.CurrentGuildName() or guild.realm ~= GetRealmName()
        or type(helper.sharedKillList) ~= "table" then return end
    -- Direct desktop return is trusted only on this authorized collector.
    -- Guild redistribution still requires a current roster officer.
    for _, entry in ipairs(helper.sharedKillList) do
        if not ns.ValidateKillWire(entry) then
            print("FlockSync: Invalid server kill-list record; sync the latest compatible server/Desktop.")
        else
            ns.MergeKillWire(entry, { officer = true }, true)
        end
    end
    if ns.LoadServerKillObservations then ns.LoadServerKillObservations() end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_GUILD_UPDATE")
frame:SetScript("OnEvent", function(_, event, unit)
    if not ns.IsOwnGuildEvent(event, unit) then return end
    ns.EnforceSnapshotGuild(ns.CurrentGuildName())
    ns.LoadSnapshot()
    ns.LoadServerKillList()
end)
