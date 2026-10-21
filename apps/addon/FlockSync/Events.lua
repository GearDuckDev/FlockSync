local addonName, ns = ...

local pendingScan = false
local function scheduleScan()
    if pendingScan then
        return
    end
    pendingScan = true
    C_Timer.After(2, function()
        pendingScan = false
        ns.PublishLocalScan(true)
    end)
end

local scanQueued = false
-- The recipe list is not populated the instant the window opens.
local function scanProfessionsSoon(source)
    if scanQueued then
        return
    end
    scanQueued = true
    C_Timer.After(0.75, function()
        scanQueued = false
        if ns.IsOnboarded() and ns.ScanProfessions(source) then
            scheduleScan()
        end
    end)
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("PLAYER_LOGOUT")
frame:RegisterEvent("PLAYER_EQUIPMENT_CHANGED")
frame:RegisterEvent("PLAYER_LEVEL_UP")
frame:RegisterEvent("UPDATE_INSTANCE_INFO")
pcall(frame.RegisterEvent, frame, "QUEST_TURNED_IN")
frame:RegisterEvent("TRADE_SKILL_SHOW")
-- CRAFT_SHOW does not exist on every client build; skip it instead of erroring.
pcall(frame.RegisterEvent, frame, "CRAFT_SHOW")
-- Fires once the recipe list is ready on clients using C_TradeSkillUI.
pcall(frame.RegisterEvent, frame, "TRADE_SKILL_LIST_UPDATE")
frame:SetScript("OnEvent", function(_, event, arg1, arg2)
    if event == "PLAYER_ENTERING_WORLD" then
        ns.RegisterAccountCharacter()
        ns.RequestLockouts()
        scheduleScan()
        -- Delay so the loading screen is gone and guild/unit data is ready.
        if arg1 ~= false or arg2 ~= false then
            C_Timer.After(3, ns.ShowStartupWindow)
        end
    elseif event == "PLAYER_LOGOUT" then
        -- Flush pending equipment changes before logout/reload writes SavedVariables.
        ns.CaptureLocalScan()
    elseif event == "TRADE_SKILL_SHOW" or event == "TRADE_SKILL_LIST_UPDATE" then
        scanProfessionsSoon("tradeskill")
    elseif event == "CRAFT_SHOW" then
        scanProfessionsSoon("craft")
    elseif event == "QUEST_TURNED_IN" then
        if arg1 == nil or not ns.IsAttunementQuest or ns.IsAttunementQuest(arg1) then
            scheduleScan()
        end
    elseif event == "PLAYER_EQUIPMENT_CHANGED" or event == "PLAYER_LEVEL_UP"
        or event == "UPDATE_INSTANCE_INFO" then
        scheduleScan()
    end
end)
