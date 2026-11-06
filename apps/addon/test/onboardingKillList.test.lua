local ui = assert(loadfile("apps/addon/test/helpers/ui.lua"))()
local ns, now, guid, broadcasts, option = {}, 100, "Player-1", 0, nil
function UnitGUID() return guid end
function GetUnitName() return "Player Name-Realm" end
function UnitName() return "Player", nil end
function GetNormalizedRealmName() return "Realm" end
function GetRealmName() return "Realm" end
function UnitIsPlayer() return true end
function UnitIsEnemy() return true end
function GetGuildInfo() return "Guild", "Member", 5 end
function GetServerTime() return now end
ns.CurrentGuildName = function() return "Guild" end
ns.LoadSnapshot = function() end
ns.BroadcastUpdate = function() broadcasts = broadcasts + 1 end
ns.BuildRoleControls = function() return { Refresh = function() end } end
ns.OpenOptions = function(tab) option = tab end
local menus = {}
Menu = { ModifyMenu = function(tag, callback) menus[tag] = callback end }
for _, name in ipairs({ "Config", "Core", "Professions", "Availability", "KillListText", "KillList",
    "KillListActions", "UIList", "UITabs", "UISettings", "UIKillEditor", "UIKillList",
    "WalkthroughFeatures", "Walkthrough", "KillListEntryPoints" }) do
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
ns.InitializeDatabase()
assert(ns.GetProfile().acceptingRequests, "Unset crafting choice defaults on")
ns.GetProfile().professions = { updatedAt = 50, list = { Alchemy = {
    name = "Alchemy", level = 1, maxLevel = 300, recipes = { 1 },
} } }
ns.GetProfile().acceptingRequests = nil
assert(ns.GetProfile().acceptingRequests)
assert(ns.BuildProfessionsPayload().primary[1].acceptingRequests)
assert(ns.BuildProfessionsPayload().updatedAt > 50)
ns.SetAcceptingRequests(false)
assert(ns.GetProfile().acceptingRequests == false, "Saved opt-out preserved")
ns.OpenWalkthrough()
local wizard = ui.find(function(w) return w.globalName == "FlockSyncWalkthroughFrame" end)
assert(#wizard.pages == 6 and not ns.IsOnboarded())
for _ = 1, 3 do ui.click(wizard.next) end
assert(wizard.pages[4]:IsShown())
local crafting = ui.find(function(w)
    return w.kind == "CheckButton" and w.text:GetText():find("^Accepting Orders")
end)
assert(not crafting:GetChecked())
crafting:SetChecked(true); ui.click(crafting)
assert(ns.GetProfile().acceptingRequests and broadcasts == 0)
ui.click(wizard.next)
assert(wizard.pages[5]:IsShown() and wizard.pages[5].openAfterFinish)
assert(ns.BuildAvailabilityPayload() == nil, "Wizard must not publish guessed availability")
ui.click(wizard.next)
assert(wizard.pages[6]:IsShown())
local enable = ui.find(function(w)
    return w.kind == "CheckButton" and w.text:GetText() == "Enable Kill List (this character)"
end)
assert(not enable:GetChecked())
enable:SetChecked(true); ui.click(enable)
assert(ns.KillListEnabled() and broadcasts == 0)
ui.click(wizard.back); ui.click(wizard.next)
assert(enable:GetChecked(), "Back/next retains choice")
ui.click(wizard.finish)
assert(ns.IsOnboarded() and broadcasts == 1 and option == "availability")
assert(ns.GetProfile().setupDone)
ns.OpenKillEditor()
local dialog = ui.find(function(w) return w.note ~= nil and w.shared ~= nil end)
dialog.name:SetText("Enemy Mixed Case")
assert(not dialog.ok:IsEnabled())
dialog.personal:SetChecked(true); ui.click(dialog.personal)
dialog.note:SetText(string.rep("x", 501)); assert(not dialog.ok:IsEnabled())
dialog.note:SetText("Reason"); assert(dialog.ok:IsEnabled())
ui.click(dialog.ok)
assert(#ns.KillEntries() == 1)
ns.OpenKillEditor()
assert(not dialog.personal:GetChecked() and not dialog.shared:GetChecked())
local item = ns.KillEntries()[1]
ns.OpenKillEditor(item, true); now = 101; ui.click(dialog.ok)
assert(#ns.KillEntries() == 0)
ui.fire("PLAYER_LOGIN")
local action
menus.MENU_UNIT_ENEMY_PLAYER(nil, { CreateButton = function(_, _, callback) action = callback end }, { unit = "target" })
assert(action); action()
assert(dialog.name:GetText() == "Player Name")
ns.SetKillSetting("enabled", false); assert(not dialog:IsShown())
-- Replaying setup preserves opt-outs and can skip the post-Finish availability editor.
ns.SetAcceptingRequests(false)
FlockSyncDB.config.hasCompletedOnboarding = false
ns.OpenWalkthrough()
for _ = 1, 4 do ui.click(wizard.next) end
local after = ui.find(function(w)
    return w.kind == "CheckButton" and w.text:GetText() == "Open availability settings after Finish"
end)
after:SetChecked(false); ui.click(after)
ui.click(wizard.next)
option = nil
ui.click(wizard.finish)
assert(option == nil and not ns.GetProfile().acceptingRequests)
guid = "Player-2"
assert(not ns.KillListEnabled() and ns.GetProfile().acceptingRequests)
for _, widget in ipairs(ui.widgets) do assert(not widget.scripts.OnEnter, "No note tooltips") end
print("Six-page onboarding, crafting defaults, Finish-only sharing and kill-list UI tests passed")
