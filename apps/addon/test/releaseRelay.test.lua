if not testNS then
    testNS = {}
    SENT = {}
    local frames, timers = {}, {}
    local now = 1000
    function CreateFrame()
        local frame = { events = {} }
        function frame:RegisterEvent(event) self.events[event] = true end
        function frame:SetScript(_, callback) self.callback = callback end
        frames[#frames + 1] = frame
        return frame
    end
    function FireEvent(event, ...)
        for _, frame in ipairs(frames) do
            if frame.events[event] and frame.callback then
                frame.callback(frame, event, ...)
            end
        end
    end
    function GetServerTime() return now end
    function AdvanceTime(seconds) now = now + seconds end
    function UnitGUID() return "Officer-1" end
    function UnitName() return "ReleaseOfficer" end
    function GetUnitName() return "ReleaseOfficer" end
    function GetNormalizedRealmName() return "Realm" end
    function GetRealmName() return "Realm" end
    function IsInGuild() return true end
    function GetGuildInfo() return "FlockGuild", "Officer", 1 end
    C_Timer = {
        After = function(_, callback) timers[#timers + 1] = callback end,
        NewTicker = function(_, callback)
            timers[#timers + 1] = callback
            return { Cancel = function() end }
        end,
    }
    function C_Timer_Run()
        local safety = 0
        while #timers > 0 and safety < 10000 do
            safety = safety + 1
            local cb = table.remove(timers, 1)
            cb()
        end
    end
    C_ChatInfo = {
        RegisterAddonMessagePrefix = function() end,
        SendAddonMessage = function(prefix, msg, channel)
            SENT[#SENT + 1] = { prefix = prefix, msg = msg, channel = channel }
        end,
    }
    for _, mod in ipairs({
        "Config", "Officer", "Core", "UpdateNotices", "Serializer",
        "Snapshot", "Roster", "Comms", "SnapshotComms",
    }) do
        assert(loadfile("apps/addon/FlockSync/" .. mod .. ".lua"))("FlockSync", testNS)
    end
end

local ns = testNS
FireEvent("ADDON_LOADED", "FlockSync")
FlockSyncDB.config.hasCompletedOnboarding = true
FlockSyncHelperDB = {
    isAuthorizedOfficer = true,
    serverTimestamp = GetServerTime(),
    culledCharacterGuids = {},
    addonReleases = {
        release = { version = "0.3.0", channel = "release" },
        alpha = { version = "0.4.0-alpha.2", channel = "alpha" },
    },
}
FireEvent("PLAYER_LOGIN")
assert(FlockSyncDB.addonReleases.release == "0.3.0", "Helper metadata must reach account cache")
assert(FlockSyncDB.addonReleases.alpha == "0.4.0-alpha.2")
C_Timer_Run()
local received
for _, message in ipairs(SENT) do
    assert(#message.msg <= 250, "Release metadata must preserve message size limits")
    if message.prefix == "FLOCKSNAP" then
        local payload = ns.ReassembleChunk(message.msg, "ReleaseOfficer", 600)
        local decoded = ns.Deserialize(payload)
        if decoded and decoded.k == "SNAP" then received = decoded end
    end
end
assert(received and received.d.u.release.version == "0.3.0", "Snapshot must relay compact release metadata")
assert(received.d.u.alpha.version == "0.4.0-alpha.2")
assert(received.d.u.release.releaseNotes == nil, "Release bodies must not inflate guild messages")
local guild = ns.CurrentGuildName()
FlockSyncDB.addonReleases = nil
ns.Snapshot.serverTimestamp = 0
received.d.t = GetServerTime()
local _, chunks = ns.ChunkPayload(ns.Serialize(received))
for _, chunk in ipairs(chunks) do
    FireEvent("CHAT_MSG_ADDON", "FLOCKSNAP", chunk, "GUILD", "OtherOfficer")
end
assert(FlockSyncDB.guildSnapshot.guild == guild, "Guild snapshot must retain guild scope")
assert(FlockSyncDB.addonReleases.release == "0.3.0", "Member must cache relayed metadata")
assert(FlockSyncDB.addonReleases.alpha == "0.4.0-alpha.2")

-- Multi-officer collision suppression & 50-player guild snapshot scaling
if AdvanceTime then
    AdvanceTime(300)
    local craftersIndex = {}
    for p = 1, 50 do
        for r = 1, 60 do
            craftersIndex[#craftersIndex + 1] = {
                itemIdOrSpellId = 10000 + r,
                characterGuid = "Crafter-" .. p,
                characterName = "Crafter " .. p,
                mainCharacterName = "Main " .. p,
                classId = (p % 9) + 1,
                level = 60,
            }
        end
    end
    FlockSyncHelperDB = {
        isAuthorizedOfficer = true,
        serverTimestamp = GetServerTime(),
        culledCharacterGuids = {},
        craftersIndex = craftersIndex,
        upcomingRaids = {},
        goalMatches = {},
    }
    ns.LoadSnapshot()
    SENT = {}
    -- A member requests a snapshot
    local _, reqChunks = ns.ChunkPayload(ns.Serialize({ k = "REQ", t = 1, guild = guild }))
    FireEvent("CHAT_MSG_ADDON", "FLOCKSNAP", reqChunks[1], "GUILD", "MemberOne")
    -- Before our jitter timer fires, another officer starts streaming chunk 1 of a multi-chunk SNAP
    local _, peerSnapChunks = ns.ChunkPayload(ns.Serialize({
        k = "SNAP",
        guild = guild,
        d = { t = GetServerTime(), c = { { g = "C1", n = "Peer", k = 1, l = 60, i = { 1, 2, 3, 4, 5 } } }, r = {}, g = {} },
    }) .. string.rep(" ", 300))
    assert(#peerSnapChunks > 1, "Peer snapshot fixture must span multiple chunks")
    FireEvent("CHAT_MSG_ADDON", "FLOCKSNAP", peerSnapChunks[1], "GUILD", "SecondOfficer")
    C_Timer_Run()
    assert(#SENT == 0, "Officer must suppress SNAP reply when another officer is already streaming chunks")

    -- Verify 50-player (3,000-entry) snapshot broadcasts and deserializes cleanly after transfer window
    AdvanceTime(300)
    FireEvent("CHAT_MSG_ADDON", "FLOCKSNAP", reqChunks[1], "GUILD", "MemberTwo")
    C_Timer_Run()
    assert(#SENT > 10, "Officer must broadcast multi-chunk snapshot when channel is clear")
    local assembled50
    for _, message in ipairs(SENT) do
        assert(#message.msg <= 240, "Every 50-player snapshot chunk must stay within 240 bytes")
        local payload = ns.ReassembleChunk(message.msg, "ReleaseOfficer", 600)
        if payload then
            assembled50 = ns.Deserialize(payload)
        end
    end
    assert(assembled50 and assembled50.k == "SNAP" and #assembled50.d.c == 50,
        "50-player crafter snapshot must compact, chunk, reassemble and deserialize cleanly")
end

print("Addon release helper and guild relay: passed")
