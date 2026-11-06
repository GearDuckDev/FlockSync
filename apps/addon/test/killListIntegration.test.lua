local ui = assert(loadfile("apps/addon/test/helpers/ui.lua"))()
local ns, guild, enemy, secret, player = {}, "Guild", true, nil, true
function UnitGUID() return "Player-1" end
function UnitName() return "Enemy", nil end
function GetUnitName(unit) return unit == "player" and "Creator Name-Realm" or "Enemy Name-Realm" end
function GetNormalizedRealmName() return "Realm" end
function GetRealmName() return "Realm" end
function UnitIsPlayer() return player end
function UnitIsEnemy() return enemy end
function issecretvalue(value) return secret ~= nil and value == secret end
function GetGuildInfo() return guild, "Member", 5 end
function GetServerTime() return 100 end
ns.CurrentGuildName = function() return guild end
ns.LoadSnapshot = function() end
ns.BuildSchedulePanel = function(container) return container end
local menus = {}
Menu = { ModifyMenu = function(tag, callback)
    menus[tag] = callback
end }
for _, name in ipairs({ "Config", "Core", "KillListText", "KillList", "KillListActions", "UIList",
    "UITabs", "UISettings", "UIKillEditor", "UIKillList", "UIOptions", "UI", "Slash", "KillListEntryPoints" }) do
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
ui.fire("ADDON_LOADED", "FlockSync")
FlockSyncDB.config.hasCompletedOnboarding = true
ui.fire("PLAYER_LOGIN")
local menu = menus.MENU_UNIT_ENEMY_PLAYER
ns.HandleSlashCommand("killoptions")
local options = ui.find(function(w) return w.globalName == "FlockSyncOptionsFrame" end)
assert(options.tabs.selected == "killlist", "Disabled feature must still have accessible options")
ns.SetKillSetting("enabled", true)
ns.HandleSlashCommand("KiLl aDd enemy mixed case")
local dialog = ui.find(function(w) return w.note ~= nil and w.shared ~= nil end)
local registeredForEscape = 0
for _, name in ipairs(UISpecialFrames) do
    if name == dialog.globalName then registeredForEscape = registeredForEscape + 1 end
end
assert(registeredForEscape == 1, "Editor registers once for WoW Escape-close handling")
assert(dialog.name:GetText() == "Enemy Mixed Case")
assert(dialog.realm == nil and dialog.targetRealm == "Realm", "Realm is automatic, not editable")
assert(dialog.note:GetHeight() >= 96, "Empty reason box has a usable click area")
local outline = ui.find(function(w) return w.parent == dialog and w.backdrop ~= nil end)
assert(outline.backdrop.edgeFile, "Reason box has a visible border")
dialog.note.parent.scripts.OnMouseDown()
assert(dialog.note.focused, "Clicking the empty reason area focuses the editor")
assert(not dialog.ok:IsEnabled())
dialog.shared:SetChecked(true); dialog.personal:SetChecked(true); ui.click(dialog.shared)
assert(dialog.ok:IsEnabled())
ui.click(dialog.ok)
assert(#ns.KillEntries() == 2)
assert(ns.KillEntries()[1].entry.name == "Enemy Mixed Case")
assert(ns.KillEntries()[1].entry.realm == "Realm", "Keep realm isolation internally")
assert(ns.ValidateKillTarget("first last", "Realm", "").name == "First Last",
    "Save validation applies the same capitalization for future sync")
assert(ns.FormatKillName("first McLast") == "First McLast", "Preserve existing internal capitalization")
ns.HandleSlashCommand("kill")
local window = ui.find(function(w) return w.globalName == "FlockSyncFeaturesFrame" end)
assert(window.tabs.selected == "killlist")
assert(window.tabs.Find("killlist").button.point[3] == -54, "Kill tab must wrap")
local row
for _, widget in ipairs(ui.widgets) do
    if widget.item and widget.item.destination == "shared" then row = widget; break end
end
assert(row and not row.edit:IsEnabled() and row.remove:IsEnabled())
assert(row.name:GetText() == "Enemy Mixed Case", "List shows the full name without a realm suffix")
local action
local root = { CreateButton = function(_, _, callback) action = callback end }
menu(nil, root, { unit = "target" })
assert(action); action()
assert(dialog.name:GetText() == "Enemy Name")
guild = "Other"
ui.fire("PLAYER_GUILD_UPDATE")
assert(not dialog:IsShown(), "Guild changes close stale editor")
guild = "Guild"
ui.fire("GUILD_ROSTER_UPDATE")
enemy, action = false, nil
menus.MENU_UNIT_PLAYER(nil, root, { unit = "target" })
assert(action and ns.KillUnitTarget("target"), "Test mode accepts friendly players")
ns.HandleSlashCommand("kill add")
assert(dialog.name:GetText() == "Enemy Name", "Target-based slash action supports friendly testing")
player = false
assert(not ns.KillUnitTarget("target"), "Test mode must still reject NPCs")
player = true
ns.KillListAllowFriendlyTesting = false
action = nil
menus.MENU_UNIT_PLAYER(nil, root, { unit = "target" }); assert(not action)
menu(nil, root, { unit = "target" }); assert(not action)
assert(not ns.KillUnitTarget("target"), "Release mode rejects friendly players")
enemy = true
menu(nil, root, { unit = "target" }); assert(action, "Release mode preserves enemy action")
enemy = {}; secret = enemy
assert(not ns.KillUnitTarget("target"), "Unreadable API values cannot identify targets")
enemy, secret = true, nil
ns.SetKillSetting("enabled", false)
assert(window.tabs.Find("killlist").hidden and window.tabs.selected == "schedule")
assert(#ns.KillEntries() == 0)
ns.SetKillSetting("enabled", true)
assert(#ns.KillEntries() == 2, "Master disable preserves entries")
ns.OpenKillEditor()
local registrations = 0
for _, name in ipairs(UISpecialFrames) do
    if name == dialog.globalName then registrations = registrations + 1 end
end
assert(registrations == 1, "Reopening must not duplicate Escape registration")
dialog.note.scripts.OnEscapePressed()
assert(not dialog:IsShown(), "Escape while editing a reason closes the editor")
print("Kill-list integration: tab wrapping, slash case, portrait guard, permissions and guild changes passed")
