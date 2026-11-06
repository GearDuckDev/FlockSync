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
assert(#net.sent == 0, "Draft creation never publishes")
assert(next(officer.ns.KillStore("shared")) == nil)
net.now = net.now + 1
assert(member.ns.PublishKillDraft(item(member, key)))
net:drain()
assert(officer.ns.KillStore("shared")[key].note == string.rep("n", 500))
assert(other.ns.KillStore("shared")[key], "Disabled/non-collector clients still receive shared data")
assert(not other.ns.KillListEnabled())
assert(next(other.ns.KillStore("personal")) == nil, "Personal copies never transmit")
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
assert(late.ns.SaveKillTarget("Draft Player", "Realm", "LOCAL_ONLY", true, false))
assert(late.ns.RespondKillSync() == nil); net:drain()
assert(not member.ns.KillStore("shared")["realm\031draft player"])
-- Newer re-add is accepted, with a new creator, only after the removal.
net.now = net.now + 1
assert(officer.ns.SaveKillTarget("Enemy Player", "Realm", "Re-add", true, false))
net.now = net.now + 1
assert(officer.ns.PublishKillDraft(item(officer, key))); net:drain()
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
-- No channel confusion; oversized/incomplete chunks do not produce entries.
net:inject(other, officer, { v = 1, guild = other.ns.KillGuildKey(), kind = "UPDATE", entry = forged }, "WHISPER")
other.ns.ReceiveKillChunk("FLOCKKILL", "100n1:1:999:" .. string.rep("x", 200), "GUILD", "Officer Two-Realm")
other.ns.ReceiveKillChunk("FLOCKKILL", string.rep("x", 251), "GUILD", "Officer Two-Realm")
assert(#net.sent == sentBefore)
print("Guild kill-list multi-client sync, permissions, privacy, reconnect, tombstones and malformed traffic passed")
