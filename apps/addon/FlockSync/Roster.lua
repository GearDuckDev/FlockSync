local addonName, ns = ...

-- Online guild members keyed by GUID and by normalized name. The roster comes
-- from GUILD_ROSTER_UPDATE; ns.RequestGuildRoster asks the server for a refresh.
local onlineByGuid = {}
local onlineByName = {}
local listeners = {}

function ns.OnGuildRosterChanged(callback)
    listeners[#listeners + 1] = callback
end

-- Lower-cases and strips our own "-Realm" suffix; names may contain spaces.
function ns.NormalizeCharacterName(name)
    if type(name) ~= "string" or name == "" then
        return nil
    end
    local realm = GetNormalizedRealmName and GetNormalizedRealmName() or nil
    if realm and realm ~= "" then
        local suffix = "-" .. realm
        if #name > #suffix and name:sub(-#suffix) == suffix then
            name = name:sub(1, #name - #suffix)
        end
    end
    return name:lower()
end

local function rebuildRoster()
    onlineByGuid, onlineByName = {}, {}
    if not IsInGuild() or not GetNumGuildMembers then
        return
    end
    for index = 1, GetNumGuildMembers() do
        local name, _, _, _, _, _, _, _, isOnline, _, _, _, _, _, _, _, guid =
            GetGuildRosterInfo(index)
        if name and isOnline then
            local key = ns.NormalizeCharacterName(name)
            if key then
                onlineByName[key] = name
            end
            if type(guid) == "string" then
                onlineByGuid[guid] = name
            end
        end
    end
end

function ns.RefreshGuildRosterCache()
    rebuildRoster()
end

function ns.RequestGuildRoster()
    if not IsInGuild() then
        return
    end
    if C_GuildInfo and C_GuildInfo.GuildRoster then
        C_GuildInfo.GuildRoster()
    elseif GuildRoster then
        GuildRoster()
    end
end

-- Returns the roster name to whisper/invite, or nil when the character is offline.
function ns.FindOnlineGuildmate(guid, name)
    if guid and onlineByGuid[guid] then
        return onlineByGuid[guid]
    end
    local key = ns.NormalizeCharacterName(name)
    return key and onlineByName[key] or nil
end

function ns.IsOwnCharacter(guid)
    return guid == UnitGUID("player")
        or (type(FlockSyncDB.accountCharacters) == "table"
            and FlockSyncDB.accountCharacters[guid] ~= nil)
end

function ns.ClassColoredName(name, classId)
    local classFile
    if C_CreatureInfo and C_CreatureInfo.GetClassInfo and classId then
        local info = C_CreatureInfo.GetClassInfo(classId)
        classFile = info and info.classFile
    end
    local color = classFile and RAID_CLASS_COLORS and RAID_CLASS_COLORS[classFile]
    if color and color.colorStr then
        return "|c" .. color.colorStr .. name .. "|r"
    end
    return name
end

function ns.InviteCharacter(name)
    if C_PartyInfo and C_PartyInfo.InviteUnit then
        C_PartyInfo.InviteUnit(name)
    elseif InviteUnit then
        InviteUnit(name)
    end
end

-- "/w Name text" splits at the first space, so two-part names use a direct tell.
function ns.WhisperCharacter(name, text)
    if not name:find(" ", 1, true) then
        ChatFrame_OpenChat("/w " .. name .. " " .. text)
        return
    end
    if ChatFrame_SendTell then
        ChatFrame_SendTell(name)
        local editBox = ChatEdit_GetActiveWindow and ChatEdit_GetActiveWindow()
        if editBox then
            editBox:Insert(text)
        end
    end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("GUILD_ROSTER_UPDATE")
frame:RegisterEvent("PLAYER_GUILD_UPDATE")
frame:SetScript("OnEvent", function()
    rebuildRoster()
    for _, callback in ipairs(listeners) do
        pcall(callback)
    end
end)
