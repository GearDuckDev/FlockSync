local ns = {}
local frames, timers, messages, tickers = {}, {}, {}, {}
local now, pants, officer, guilded, onboarded = 100, true, false, false, true
local guildNameAvailable = true
FlockSyncDB = {
    characters = {}, profiles = {}, accountCharacters = {}, staleCharacters = {},
    config = { hasCompletedOnboarding = true },
}
function CreateFrame()
    local frame = { events = {}, scripts = {} }
    function frame:RegisterEvent(event) self.events[event] = true end
    function frame:SetScript(kind, callback)
        self.scripts[kind] = callback
        if kind == "OnEvent" then self.callback = callback end
    end
    function frame:HookScript(kind, callback)
        local prev = self.scripts[kind]
        self.scripts[kind] = function(...)
            if prev then prev(...) end
            callback(...)
        end
    end
    frames[#frames + 1] = frame
    return frame
end
function UnitGUID(unit)
    if unit and unit:match("^raid(%d+)$") then
        return "Raid-Member-" .. unit:match("^raid(%d+)$")
    end
    return "Player-Test"
end
function UnitName() return "Tester" end
function GetUnitName() return "Tester Two" end
function GetNormalizedRealmName() return "Realm" end
function GetRealmName() return "Realm" end
function UnitClass() return "Warrior", "WARRIOR", 1 end
function UnitLevel() return 60 end
function GetServerTime() return now end
function IsInGuild() return guilded end
function GetGuildInfo() return (guilded and guildNameAvailable) and "Guild" or nil end
function GetInventoryItemLink(_, slot)
    if slot == 7 and pants then return "|cffa335ee|Hitem:100:0:0:0|h[Test Pants]|h|r" end
end
function GetInventoryItemID(_, slot)
    if slot == 7 and pants then return 100 end
end
C_Timer = {
    After = function(_, callback) timers[#timers + 1] = callback end,
    NewTicker = function(_, callback)
        local t = { callback = callback, cancelled = false }
        function t:Cancel() self.cancelled = true end
        tickers[#tickers + 1] = t
        return t
    end,
}
C_ChatInfo = {
    RegisterAddonMessagePrefix = function() end,
    SendAddonMessage = function(prefix, chunk)
        messages[#messages + 1] = { prefix = prefix, chunk = chunk }
    end,
}
ns.IsOnboarded = function() return onboarded end
ns.GetProfile = function()
    FlockSyncDB.profiles["Player-Test"] = FlockSyncDB.profiles["Player-Test"] or {
        role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 1 },
    }
    return FlockSyncDB.profiles["Player-Test"]
end
ns.IsPlayerOfficer = function() return officer end
ns.ReviveStaleCharacter = function() end
ns.BuildAvailabilityPayload = function() end
ns.ScanLockouts = function() return { updatedAt = now, lockouts = {} } end
ns.RequestLockouts = function() end
ns.ShowStartupWindow = function() end
local function load(name)
    assert(loadfile("apps/addon/FlockSync/" .. name .. ".lua"))("FlockSync", ns)
end
load("Core")
load("Attunements")
load("Professions")
load("GearGoals")
load("ItemSearch")
load("Scanner")
load("Serializer")
load("Comms")
load("Ledger")
load("Events")
local function fire(event, ...)
    for _, frame in ipairs(frames) do
        if frame.events[event] then frame.callback(frame, event, ...) end
    end
end
local function drainTimers()
    while #timers > 0 do
        local cb = table.remove(timers, 1)
        cb()
    end
end
local function drainTickers()
    for _, t in ipairs(tickers) do
        while not t.cancelled do
            t.callback()
        end
    end
end

ns.PublishLocalScan()
assert(FlockSyncDB.characters["Player-Test"].gear.items[1].slotId == 7)
assert(FlockSyncDB.characters["Player-Test"].lastSeenAt == 100)
now, pants = 200, false
fire("PLAYER_EQUIPMENT_CHANGED")
assert(#timers == 1)
-- Logout may happen before the debounced two-second equipment scan.
fire("PLAYER_LOGOUT")
local character = FlockSyncDB.characters["Player-Test"]
assert(#character.gear.items == 0, "Removed pants must disappear from the exported character")
assert(character.gear.updatedAt == 200)
assert(character.lastSeenAt == 200)
assert(FlockSyncDB.exportedAt == 200)
assert(#messages == 0, "Logout capture must not broadcast")
assert(FlockSyncDB.collectorGuild == nil, "Guildless scans must not request a collector grant")

ns.MergeCharacter({ guid = "Player-Test", gear = { updatedAt = 100, items = { { slotId = 7 } } }, lastSeenAt = 100 })
assert(#character.gear.items == 0, "Older guild echoes must not restore removed gear")
assert(character.lastSeenAt == 200)

guilded = true
ns.CaptureLocalScan()
assert(FlockSyncDB.collectorGuild.name == "Guild" and FlockSyncDB.collectorGuild.realm == "Realm")
local remote = { guid = "Other", name = "Other", realm = "Realm", gear = { updatedAt = 201, items = {} }, lastSeenAt = 201 }
local _, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.Other == nil, "Non-officers must not aggregate other characters")
officer = true
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.Other.lastSeenAt == 201, "Officers must still aggregate guild broadcasts")
load("Officer")
FlockSyncHelperDB = {
    isAuthorizedOfficer = true,
    authorizedCollectorGuild = { name = "Guild", realm = "Realm" },
}
assert(ns.GetOfficerStatusReason() == "Website Officer/Admin (Same Guild)")
remote.guid = "WebsiteCollected"
_, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.WebsiteCollected, "Website-authorized low-rank alt must catch guild broadcasts")
FlockSyncHelperDB.authorizedCollectorGuild.realm = "OtherRealm"
remote.guid = "NotAuthorized"
_, chunks = ns.ChunkPayload(ns.Serialize({ updateType = "CHARACTER", data = remote, guild = "Guild" }))
for _, chunk in ipairs(chunks) do fire("CHAT_MSG_ADDON", "FLOCKSYNC", chunk, "GUILD", "Other") end
assert(FlockSyncDB.characters.NotAuthorized == nil, "Mismatched collector grant must not catch broadcasts")
onboarded, now = false, 300
fire("PLAYER_LOGOUT")
assert(character.lastSeenAt == 200, "Onboarding must still gate capture")

-- 1. Outbound CHARACTER queue coalescing, guild-name retry recovery & background event deduplication
onboarded = true
FlockSyncHelperDB.authorizedCollectorGuild.realm = "Realm"
drainTimers()
drainTickers()
messages, tickers, timers = {}, {}, {}
-- When guild name is temporarily unavailable across all retries, characterRetryActive and fingerprint must reset
guildNameAvailable = false
pants = true
now = 350
ns.PublishLocalScan(true)
drainTimers()
drainTickers()
assert(#messages == 0, "Unavailable guild name must skip broadcasting")
guildNameAvailable = true
now = 355
ns.PublishLocalScan(true)
drainTimers()
drainTickers()
assert(#messages > 0, "Subsequent background scan must retry after guild name becomes available")

messages, tickers, timers = {}, {}, {}
for step = 1, 7 do
    now = 400 + step
    ns.GetProfile().role.primaryRole = (step % 2 == 0) and "TANK" or "HEALER"
    ns.GetProfile().role.updatedAt = now
    ns.PublishLocalScan()
end
drainTickers()
local reassembledCount = 0
local lastRole
for _, m in ipairs(messages) do
    local payload = ns.ReassembleChunk(m.chunk, "Tester Two")
    if payload then
        reassembledCount = reassembledCount + 1
        lastRole = ns.Deserialize(payload).data.role.primaryRole
    end
end
assert(reassembledCount == 1, "Rapid unstarted CHARACTER updates must coalesce into one broadcast")
assert(lastRole == "HEALER", "Coalesced broadcast must carry the latest character state")

-- Background scan with unchanged character data must not rebroadcast within heartbeat window
messages, tickers = {}, {}
now = 420
ns.PublishLocalScan(true)
drainTickers()
assert(#messages == 0, "Unchanged background scan must not spam guild broadcasts")

-- Non-attunement quest turn-ins must be ignored; attunement quests must schedule a scan
timers = {}
fire("QUEST_TURNED_IN", 999999)
assert(#timers == 0, "Unrelated quest turn-ins must not schedule a full character scan")
fire("QUEST_TURNED_IN", 7848)
assert(#timers == 1, "Tracked attunement quest turn-ins must schedule a scan")
drainTimers()
drainTickers()

-- 2. Raid Ledger: ignore rolls/crafts, preserve two-part officer names, deduplicate minute boundaries
function IsInInstance() return true, "raid" end
function IsInRaid() return true end
function GetInstanceInfo() return "Molten Core" end
function GetNumGroupMembers() return 40 end
local epicLink = "|cffa335ee|Hitem:18803:0:0:0|h[Finkle's Lava Dredger]|h|r"
FlockSyncDB.guildLedger = { loot = {}, attendance = {} }
now = 1199
fire("CHAT_MSG_LOOT", "SomeRaider rolls 99 (1-100) on: " .. epicLink)
fire("CHAT_MSG_LOOT", "SomeRaider has selected Need for: " .. epicLink)
fire("CHAT_MSG_LOOT", "SomeRaider won: " .. epicLink)
fire("CHAT_MSG_LOOT", "You create: " .. epicLink .. ".")
assert(#FlockSyncDB.guildLedger.loot == 0, "Roll and craft messages must never record fake loot")

fire("CHAT_MSG_LOOT", "You receive loot: " .. epicLink .. ".")
assert(#FlockSyncDB.guildLedger.loot == 1, "Actual self loot must be recorded")
assert(FlockSyncDB.guildLedger.loot[1].recipientName == "Tester Two", "Self loot must keep two-part character names")

-- Cross-officer loot & attendance arriving across a 60-second boundary (1199 vs 1200) must deduplicate
local boundaryLoot = {
    id = "LTester Two-18803-20",
    itemId = 18803,
    itemLink = epicLink,
    recipientGuid = "Player-Test",
    recipientName = "Tester Two",
    instanceName = "Molten Core",
    timestamp = 1200,
}
assert(not ns.MergeLedgerEntry("LOOT", boundaryLoot), "Cross-officer loot across a minute boundary must deduplicate")
assert(#FlockSyncDB.guildLedger.loot == 1)

now = 1199
fire("ENCOUNTER_END", 663, "Lucifron", 1, 40, 1)
assert(#FlockSyncDB.guildLedger.attendance == 1)
assert(#FlockSyncDB.guildLedger.attendance[1].rosterGuids == 40)
local boundaryAttendance = {
    id = "A663-20",
    instanceName = "Molten Core",
    timestamp = 1200,
    rosterGuids = { "Raid-Member-1" },
    benchGuids = {},
}
assert(not ns.MergeLedgerEntry("ATTENDANCE", boundaryAttendance), "Cross-officer attendance across a minute boundary must deduplicate")
assert(#FlockSyncDB.guildLedger.attendance == 1)

-- 3. Professions: prune unlearned professions & ensure UI summary does not swallow pending prune
local activeProfessions = { "Tailoring", "Alchemy" }
function GetProfessions() return 1, 2 end
function GetProfessionInfo(index) return activeProfessions[index] end
C_TradeSkillUI = {
    GetAllRecipeIDs = function() return { 101, 102 } end,
    GetRecipeInfo = function() return { learned = true } end,
    GetRecipeOutputItemData = function(id) return { itemID = id + 1000 } end,
    GetBaseProfessionInfo = function() return { professionName = "Tailoring", skillLevel = 300, maxSkillLevel = 300 } end,
}
now = 1300
assert(ns.ScanProfessions("tradeskill") == true, "First profession scan must record changes")
assert(ns.ScanProfessions("tradeskill") == false, "Identical profession rescan must not trigger a broadcast")
C_TradeSkillUI.GetBaseProfessionInfo = function()
    return { professionName = "Alchemy", skillLevel = 300, maxSkillLevel = 300 }
end
now = 1305
assert(ns.ScanProfessions("tradeskill") == true, "Scanning second profession must record changes")
ns.PublishLocalScan()
drainTickers()
assert(#FlockSyncDB.characters["Player-Test"].professions.primary == 2)
-- Now player drops Tailoring, opens the FlockSync profession summary first, then scans/publishes
activeProfessions = { "Alchemy", "Herbalism" }
now = 1310
local summaryText = ns.ProfessionSummary()
assert(not summaryText:find("Tailoring", 1, true), "ProfessionSummary must hide dropped profession immediately")
assert(ns.ScanProfessions("tradeskill") == true,
    "Opening ProfessionSummary before TradeSkill must not prevent ScanProfessions from reporting the dropped profession")
ns.PublishLocalScan()
drainTickers()
local profPayload = FlockSyncDB.characters["Player-Test"].professions
assert(#profPayload.primary == 1 and profPayload.primary[1].name == "Alchemy" and profPayload.updatedAt >= 1310,
    "Dropped professions must clear from exported character record even after ProfessionSummary ran")

-- 4. 50-player Guild ItemSearch scaling & bounded 2,000-item eviction bookkeeping
FlockSyncDB.itemSearchCache = {}
for p = 1, 50 do
    local gItems = {}
    for slot = 1, 42 do
        local id = p * 100 + slot
        gItems[#gItems + 1] = {
            slotId = slot,
            itemId = id,
            itemLink = string.format("|cffa335ee|Hitem:%d:0:0:0|h[Guild Item %d]|h|r", id, id),
        }
    end
    FlockSyncDB.characters["Guildie-" .. p] = {
        guid = "Guildie-" .. p, name = "Guildie" .. p, realm = "Realm",
        classId = 1, level = 60, gear = { updatedAt = 1400, items = gItems }, lastSeenAt = 1400,
    }
end
pants = true
for pass = 1, 5 do
    now = 1500 + pass * 10
    ns.RefreshItemSearch(true)
end
local cachedKeys = 0
for _ in pairs(FlockSyncDB.itemSearchCache) do
    cachedKeys = cachedKeys + 1
end
assert(cachedKeys <= 2000, "Persisted itemSearchCache must stay bounded at 2,000 items")
local ownMatches = ns.FindGoalItems("Test Pants")
assert(#ownMatches == 1 and ownMatches[1].itemId == 100,
    "Player's own equipped items must remain searchable even when 50 guild members exceed 2,000 items")

-- 5. Enchant Spell ID vs Item ID collision & caching in UIList.ResolveRecipeOutput
local itemInfoCalls = 0
C_Item = {
    GetItemInfoInstant = function(id) return id, "Armor", "Misc", "INVTYPE_NON_EQUIP", 111111 end,
    GetItemInfo = function(id)
        itemInfoCalls = itemInfoCalls + 1
        if id == 7418 then return "Unrelated Item 7418", "item:7418", 1, 1, 1, "Armor", "Misc", 1, "", 111111 end
        if id == 12640 then return "Lionheart Helm", "|cffa335ee|Hitem:12640|h[Lionheart Helm]|h|r", 4, 60, 56, "Armor", "Plate", 1, "INVTYPE_HEAD", 222222 end
    end,
}
C_Spell = {
    GetSpellInfo = function(id)
        if id == 7418 then return { name = "Enchant Bracer - Minor Health", iconID = 333333 } end
    end,
}
load("UIList")
local rName, _, rIcon, rIsItem = ns.ResolveRecipeOutput(7418)
assert(rName == "Enchant Bracer - Minor Health" and rIcon == 333333 and rIsItem == false,
    "Enchant spell IDs must not collide with numeric Item IDs")
for _ = 1, 50 do
    local helmName, _, _, helmIsItem = ns.ResolveRecipeOutput(12640)
    assert(helmName == "Lionheart Helm" and helmIsItem == true)
end
assert(itemInfoCalls == 1, "Resolved recipe output must be cached across repeated lookups")

-- 6. Tooltip duplicate line protection
ns.IsEnabled = function() return true end
ns.Snapshot = {
    goalsByItem = { [12640] = { { characterGuid = "G1", characterName = "TankOne" } } },
    craftersByItem = { [12640] = { { characterGuid = "C1", characterName = "SmithOne" } } },
}
local tooltipLines = {}
GameTooltip = {
    HookScript = function(self, event, cb) self[event] = cb end,
    GetItem = function() return "Lionheart Helm", "item:12640" end,
    AddLine = function(_, text) tooltipLines[#tooltipLines + 1] = text end,
}
load("Tooltips")
GameTooltip:OnTooltipSetItem()
GameTooltip:OnTooltipSetItem()
assert(#tooltipLines == 2, "Repeated tooltip refreshes must not append duplicate FlockSync lines")
GameTooltip:OnTooltipCleared()
GameTooltip:OnTooltipSetItem()
assert(#tooltipLines == 4, "Cleared tooltips must annotate the next hovered item")

-- 7. 50-player Guild Roster & AutoInviteRaid party-to-raid conversion
function GetNumGuildMembers() return 50 end
function GetGuildRosterInfo(i)
    return "Raider" .. i .. "-Realm", "Raider", 3, 60, "Warrior", "Orgrimmar", "", "", true, 0, "WARRIOR", 0, 0, false, false, 0, "Guildie-" .. i
end
local invited, converted = {}, false
local inRaid = false
function IsInGroup() return true end
function IsInRaid() return inRaid end
function GetNumGroupMembers() return 2 end
function UnitIsGroupLeader() return true end
function UnitInRaid() return nil end
function UnitInParty() return false end
C_PartyInfo = {
    InviteUnit = function(name) invited[#invited + 1] = name end,
    ConvertToRaid = function() converted = true; inRaid = true end,
}
load("Roster")
load("RaidAssignments")
local assignments = {}
for i = 1, 40 do
    assignments[i] = { characterGuid = "Guildie-" .. i, characterName = "Raider" .. i, isBench = false }
end
ns.AutoInviteRaid({ name = "40-Man Raid", assignments = assignments })
assert(converted == true, "Existing party must convert to raid immediately when inviting >5 raid members")
assert(#invited == 40, "All 40 online assigned raid members must be invited")

print("Local scan export, logout flush, empty gear, epochs and officer-only aggregation: passed")
