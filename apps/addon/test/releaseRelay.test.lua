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
print("Addon release helper and guild relay: passed")
