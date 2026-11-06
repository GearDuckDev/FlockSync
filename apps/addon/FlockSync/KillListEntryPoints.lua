local addonName, ns = ...
-- Temporary testing switch; must be false before the final commit.
ns.KillListAllowFriendlyTesting = true

local function readable(value)
    if issecretvalue and issecretvalue(value) then return nil end
    return value
end
function ns.KillUnitTarget(unit)
    if type(unit) ~= "string" or not readable(UnitIsPlayer(unit)) then return nil end
    local enemy = readable(UnitIsEnemy("player", unit))
    if enemy == nil or (not enemy and not ns.KillListAllowFriendlyTesting) then return nil end
    local name, realm = UnitName(unit)
    if issecretvalue and (issecretvalue(name) or issecretvalue(realm)) then return nil end
    if type(name) ~= "string" or name == "" then return nil end
    local full = readable(GetUnitName and GetUnitName(unit, true))
    if type(full) == "string" then
        local normalized = type(realm) == "string" and realm ~= "" and realm:gsub("%s", "")
            or (GetNormalizedRealmName and readable(GetNormalizedRealmName()))
        local suffix = normalized and ("-" .. normalized)
        name = suffix and full:sub(-#suffix) == suffix and full:sub(1, -#suffix - 1) or full
    end
    return { name = name, realm = realm and realm ~= "" and realm or GetRealmName() }
end
function ns.KillSlash(message)
    local command, name = (message or ""):match("^%s*(%S*)%s*(.-)%s*$")
    if string.lower(command) == "add" then
        ns.OpenKillEditor(nil, false, name ~= "" and { name = ns.FormatKillName(name), realm = GetRealmName() }
            or ns.KillUnitTarget("target"))
    elseif command == "" then ns.OpenFeatures("killlist")
    elseif string.lower(command) == "sync" then ns.RequestKillSync()
    else print("FlockSync: Use /fs kill, /fs kill add [player name], /fs kill sync, or /fs killoptions.") end
end
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_GUILD_UPDATE")
frame:RegisterEvent("GUILD_ROSTER_UPDATE")
frame:SetScript("OnEvent", function(_, event)
    if event ~= "PLAYER_LOGIN" then ns.KillListChanged(); return end
    if not Menu or not Menu.ModifyMenu then
        print("FlockSync: Portrait menu unavailable; use /fs kill add.")
        return
    end
    local function addAction(_, root, context)
        if not ns.IsOnboarded() or not ns.KillListEnabled() then return end
        local target = ns.KillUnitTarget(context and context.unit)
        local label = ns.KillListAllowFriendlyTesting and "FlockSync: Add kill-list target (TEST)"
            or "FlockSync: Add kill-list target"
        if target then root:CreateButton(label,
            function() ns.OpenKillEditor(nil, false, target) end) end
    end
    Menu.ModifyMenu("MENU_UNIT_ENEMY_PLAYER", addAction)
    for _, tag in ipairs({ "PLAYER", "PARTY", "RAID_PLAYER", "TARGET", "FOCUS" }) do
        Menu.ModifyMenu("MENU_UNIT_" .. tag, function(...)
            if ns.KillListAllowFriendlyTesting then addAction(...) end
        end)
    end
    if ns.KillListAllowFriendlyTesting then
        print("FlockSync: Kill List TEST mode allows friendly players. Remove test entries before release.")
    end
end)
