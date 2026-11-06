local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local member = net:client("Member One", "P1", 5)
local officer = net:client("Officer Two", "P2", 1)
local other = net:client("Member Three", "P3", 5)
local function item(client, key)
    return { key = key, destination = "shared", entry = client.ns.KillStore("shared")[key] }
end
member.ns.SetKillSetting("enabled", true)
assert(member.ns.SaveKillTarget("enemy player", "Realm", string.rep("n", 500), true, true))
local key = "realm\031enemy player"
net:drain()
assert(#net.sent > 0, "Guild Shared creation sends automatically without Publish")
assert(member.ns.KillStore("shared")[key].sharedLive)
assert(officer.ns.KillStore("shared")[key].note == string.rep("n", 500))
assert(other.ns.KillStore("shared")[key], "Disabled/non-collector clients still receive shared data")
assert(not other.ns.KillListEnabled())
assert(next(other.ns.KillStore("personal")) == nil, "Personal copies never transmit")
local sends = #net.sent
assert(member.ns.SaveKillTarget("Private Player", "Realm", "PRIVATE_ONLY", false, true))
net:drain()
assert(#net.sent == sends and not officer.ns.KillStore("shared")["realm\031private player"],
    "Personal-only save must not send a guild message")
other.ns.SetKillSetting("enabled", true)
assert(not other.ns.ChangeKillTarget(item(other, key), "Forged", false))
officer.ns.SetKillSetting("enabled", true)
net.now = net.now + 1
assert(officer.ns.ChangeKillTarget(item(officer, key), "Officer edit", false))
net:drain()
assert(member.ns.KillStore("shared")[key].note == "Officer edit")
assert(member.ns.KillStore("personal")[key].note == string.rep("n", 500))
assert(not member.ns.ChangeKillTarget(item(member, key), "Creator cannot edit", false))
local stale = {}
for field, value in pairs(officer.ns.KillStore("shared")[key]) do stale[field] = value end
other.online = false
net.now = net.now + 1
assert(member.ns.ChangeKillTarget(item(member, key), "", true))
net:drain()
assert(officer.ns.KillStore("shared")[key].deleted)
assert(not other.ns.KillStore("shared")[key].deleted)
other.online = true
assert(other.ns.RequestKillSync())
net:drain()
assert(other.ns.KillStore("shared")[key].deleted, "Offline receiver catches up with durable removal")
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = stale })
assert(other.ns.KillStore("shared")[key].deleted, "Old snapshots cannot resurrect removals")
local late = net:client("Late Four", "P4", 5)
assert(late.ns.RequestKillSync()); net:drain()
assert(late.ns.KillStore("shared")[key].deleted, "Late join learns tombstones even without the creator online")
local forged = {}
for field, value in pairs(stale) do forged[field] = value end
forged.updatedAt = math.floor(net.now)
forged.note = "Spoofed officer"
net:inject(other, member, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = forged })
assert(other.ns.KillStore("shared")[key].deleted, "Members cannot provide authoritative snapshots")
net:inject(other, member, { v = 1, guild = other.ns.KillGuildKey(), kind = "UPDATE", entry = forged })
assert(other.ns.KillStore("shared")[key].deleted, "Cannot claim another actor's identity")
forged.updatedAt = math.floor(net.now) + 9999
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = forged })
assert(other.ns.KillStore("shared")[key].deleted, "Far-future poisoning rejected")
-- Existing local drafts survive incoming snapshots without leaking to the guild.
net.now = net.now + 1
assert(late.ns.SetKillSetting("enabled", true))
late.ns.KillStore("shared")["realm\031draft player"] = {
    name = "Draft Player", realm = "Realm", note = "LOCAL_ONLY", author = late.name,
    authorGuid = late.guid, createdAt = math.floor(net.now), updatedAt = math.floor(net.now)
}
assert(late.ns.RespondKillSync() == nil); net:drain()
assert(not member.ns.KillStore("shared")["realm\031draft player"])
net.now = net.now + 1
assert(late.ns.PublishKillDraft(item(late, "realm\031draft player")))
net:drain()
assert(member.ns.KillStore("shared")["realm\031draft player"].note == "LOCAL_ONLY",
    "Legacy drafts still require an explicit share action")
-- Newer re-add is accepted, with a new creator, only after the removal.
net.now = net.now + 1
assert(officer.ns.SaveKillTarget("Enemy Player", "Realm", "Re-add", true, false))
net:drain()
assert(not member.ns.KillStore("shared")[key].deleted)
assert(member.ns.KillStore("shared")[key].authorGuid == "P2")
-- Equal-time conflicting updates must not overwrite.
forged = {}
for field, value in pairs(officer.ns.KillStore("shared")[key]) do forged[field] = value end
forged.note = "Equal-time conflict"
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "UPDATE", entry = forged })
assert(other.ns.KillStore("shared")[key].note == "Re-add")
local sentBefore = #net.sent
officer.guild = "Another Guild"
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = forged })
assert(other.ns.KillStore("shared")[key].note == "Re-add", "Non-guild senders are rejected")
officer.guild = "Guild"
-- Authorized snapshots repair stale creation identities, even when the new generation was edited before catch-up.
net.now = net.now + 1
assert(officer.ns.SaveKillTarget("Catch Up Player", "Realm", "Initial", true, false))
net:drain()
local catchUpKey = "realm\031catch up player"
other.online, late.online = false, false
net.now = net.now + 1
assert(officer.ns.ChangeKillTarget(item(officer, catchUpKey), "", true))
net:drain()
local removed = officer.ns.KillStore("shared")[catchUpKey]
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = removed })
assert(other.ns.KillStore("shared")[catchUpKey].deleted, "One stale client knows the removal")
net.now = net.now + 1
assert(officer.ns.SaveKillTarget("Catch Up Player", "Realm", "Re-added", true, false))
net:drain()
net.now = net.now + 1
assert(officer.ns.ChangeKillTarget(item(officer, catchUpKey), "Edited before sync", false))
net:drain()
local current = officer.ns.KillStore("shared")[catchUpKey]
other.online, late.online = true, true
net:inject(late, officer, { v = 1, guild = late.ns.KillGuildKey(), kind = "UPDATE", entry = current })
assert(late.ns.KillStore("shared")[catchUpKey].note == "Initial",
    "Ordinary updates cannot replace an existing creation identity")
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "SNAP", entry = current })
net:inject(late, officer, { v = 1, guild = late.ns.KillGuildKey(), kind = "SNAP", entry = current })
assert(other.ns.KillStore("shared")[catchUpKey].note == "Edited before sync",
    "Snapshots can catch up a re-add that was edited after creation")
assert(late.ns.KillStore("shared")[catchUpKey].createdAt == current.createdAt,
    "Snapshots can supersede an active entry when the removal and re-add were both missed")
-- No channel confusion; oversized/incomplete chunks do not produce entries.
sentBefore = #net.sent
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "UPDATE", entry = forged }, "WHISPER")
other.ns.ReceiveKillChunk("FLOCKKILL", "100n1:1:999:" .. string.rep("x", 200), "GUILD", "Officer Two-Realm")
other.ns.ReceiveKillChunk("FLOCKKILL", string.rep("x", 251), "GUILD", "Officer Two-Realm")
assert(#net.sent == sentBefore)
print("Guild kill-list multi-client sync, permissions, privacy, reconnect, tombstones and malformed traffic passed")
