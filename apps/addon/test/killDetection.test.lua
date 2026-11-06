local net = assert(loadfile("apps/addon/test/helpers/killObservationNetwork.lua"))()
local localClient = net:client("Member One", "P1", 5)
local officer = net:client("Officer Two", "P2", 1)
local member = net:client("Member Three", "P3", 5)
local item = net:addTarget(localClient, "Enemy Player")
net:addTarget(officer, "Enemy Player")
net:addTarget(member, "Enemy Player")
local private = net:addTarget(localClient, "Private Player", true)
local units = localClient.units
units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = true, player = true }
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 1)
assert(#localClient.ns.KillObservationRows(item, false) == 1)
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 1, "Repeated unit events obey the exact per-target cooldown")
net:drain()
assert(officer.sounds == 0 and member.sounds == 0, "Remote sightings never trigger nearby alerts")
assert(#officer.ns.KillObservationRows(item, false) == 1)
net.now = 159
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 1, "59 seconds is still inside cooldown")
net.now = 160
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 2, "60-second boundary permits new local alert")
localClient.ns.SetKillSetting("soundEnabled", false)
net.now = 220
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 2, "Sound independent from popup")
localClient.ns.SetKillSetting("popupEnabled", false)
localClient.ns.SetKillSetting("soundEnabled", true)
net.now = 280
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 3, "Popup independent from sound")
localClient.ns.SetKillSetting("enabled", false)
net.now = 340
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 3, "Disabled feature cannot observe or alert")
localClient.ns.SetKillSetting("enabled", true)
units.target = { name = "Private Player", guid = "Private-1", enemy = true, player = true }
localClient:fire("PLAYER_TARGET_CHANGED")
assert(#localClient.ns.KillObservationRows(private, false) == 1)
net:drain()
for _, client in ipairs({ officer, member }) do
    for _, entry in pairs(client.ns.KillObservationStore("shared")) do assert(entry.name ~= "Private Player") end
end
localClient.ns.SetKillSetting("personalEnabled", false)
net.now = net.now + 60
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 4, "Personal-only target ignored when personal disabled")
units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = { secret = true }, player = true }
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 4, "Secret hostility cannot identify an enemy")
units.target.enemy = true
units.target.guid = { secret = true }
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 4, "Secret GUID cannot be used")
units.target = { name = "Enemy Player", guid = "Enemy-1", enemy = false, player = true }
localClient:fire("PLAYER_TARGET_CHANGED")
assert(localClient.sounds == 4, "Friendly testing permits entry creation, never enemy alerts")
local plate = {}
units.nameplate1 = { name = "Enemy Player", guid = "Enemy-1", enemy = true, player = true, plate = plate }
localClient:fire("NAME_PLATE_UNIT_ADDED", "nameplate1")
localClient.ns.SetKillSetting("skullEnabled", true)
local icon
for _, widget in ipairs(localClient.widgets) do if widget.parent == plate then icon = widget end end
assert(icon and icon.shown, "Skull is a local nameplate child")
localClient:fire("NAME_PLATE_UNIT_REMOVED", "nameplate1")
assert(not icon.shown, "Removed plates cannot retain skull")
units.nameplate1.name = "Unlisted Player"
localClient:fire("NAME_PLATE_UNIT_ADDED", "nameplate1")
assert(not icon.shown, "Reused plate cannot mark another player")
units.nameplate1.name = "Enemy Player"
localClient:fire("NAME_PLATE_UNIT_ADDED", "nameplate1")
assert(icon.shown)
localClient.ns.SetKillSetting("skullEnabled", false)
assert(not icon.shown, "Disabling skull removes it immediately")
localClient.ns.SetKillSetting("skullEnabled", true)
localClient.guild = "Other"
localClient:fire("PLAYER_GUILD_UPDATE")
assert(not icon.shown, "Guild changes clear visible skulls")
print("Local detection, exact cooldown, independent settings, privacy, secrets and skull lifecycle: passed")
