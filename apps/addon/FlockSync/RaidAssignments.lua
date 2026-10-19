local addonName, ns = ...

-- Invites a raid team's assigned (non-bench) members who are online. A party
-- only holds 5, so the rest wait for the group to form and be converted.
local pendingInvites = {}

local function isLeader()
    return UnitIsGroupLeader("player") or (IsInRaid() and UnitIsGroupAssistant("player"))
end

local function convertToRaid()
    if C_PartyInfo and C_PartyInfo.ConvertToRaid then
        C_PartyInfo.ConvertToRaid()
    elseif ConvertToRaid then
        ConvertToRaid()
    end
end

local function alreadyGrouped(name)
    return UnitInRaid(name) ~= nil or UnitInParty(name) == true
end

local function inviteAll(names)
    for _, name in ipairs(names) do
        ns.InviteCharacter(name)
    end
end

local function flushPending()
    if #pendingInvites == 0 or not IsInGroup() or not isLeader() then
        return
    end
    if not IsInRaid() then
        convertToRaid()
        return
    end
    local names = pendingInvites
    pendingInvites = {}
    inviteAll(names)
end

function ns.AutoInviteRaid(raid)
    if IsInGroup() and not isLeader() then
        print("FlockSync: Only the group leader or an assistant can invite.")
        return
    end
    local names, offline = {}, 0
    for _, assignment in ipairs(raid.assignments or {}) do
        if not assignment.isBench and assignment.characterGuid ~= UnitGUID("player") then
            local rosterName = ns.FindOnlineGuildmate(assignment.characterGuid, assignment.characterName)
            if not rosterName then
                offline = offline + 1
            elseif not alreadyGrouped(rosterName) then
                names[#names + 1] = rosterName
            end
        end
    end
    print(string.format("FlockSync: Inviting %d online member(s) of %s (%d offline).",
        #names, raid.name, offline))
    if #names == 0 then
        return
    end
    local groupSize = IsInGroup() and GetNumGroupMembers() or 1
    if IsInRaid() or groupSize + #names <= 5 then
        inviteAll(names)
        return
    end
    -- Fill the party now, convert once someone accepts, then invite the rest.
    pendingInvites = {}
    local room = math.max(0, 5 - groupSize)
    local now = {}
    for index, name in ipairs(names) do
        if index <= room then
            now[#now + 1] = name
        else
            pendingInvites[#pendingInvites + 1] = name
        end
    end
    inviteAll(now)
    flushPending()
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("GROUP_ROSTER_UPDATE")
frame:SetScript("OnEvent", flushPending)
