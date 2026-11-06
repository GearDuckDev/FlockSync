local net = assert(loadfile("apps/addon/test/helpers/killNetwork.lua"))()
local baseClient = net.client
function net:client(name, guid, rank)
    local client = baseClient(self, name, guid, rank)
    local env, ns = client.env, client.ns
    client.units = { player = { name = name, guid = guid, enemy = false, player = true } }
    env.UnitGUID = function(unit) return client.units[unit] and client.units[unit].guid end
    env.UnitName = function(unit) return client.units[unit] and client.units[unit].name, "Realm" end
    env.GetUnitName = function(unit)
        local value = client.units[unit]
        return value and (value.name .. "-Realm")
    end
    env.UnitIsPlayer = function(unit) return client.units[unit] and client.units[unit].player end
    env.UnitIsEnemy = function(_, unit) return client.units[unit] and client.units[unit].enemy end
    env.GetRealZoneText = function() return "Test Zone" end
    env.issecretvalue = function(value) return type(value) == "table" and value.secret == true end
    env.issecrettable = env.issecretvalue
    client.sounds, client.widgets = 0, {}
    env.SOUNDKIT = { RAID_WARNING = 1 }
    env.PlaySound = function() client.sounds = client.sounds + 1 end
    local baseFrame = env.CreateFrame
    env.CreateFrame = function(...)
        local frame = baseFrame(...)
        frame.shown = false
        function frame:Show() self.shown = true end
        function frame:Hide() self.shown = false end
        function frame:IsShown() return self.shown end
        function frame:SetParent(parent) self.parent = parent end
        function frame:SetScript(kind, callback)
            if kind == "OnEvent" then self.callback = callback else self[kind] = callback end
        end
        function frame:CreateTexture()
            local texture = {}
            for _, method in ipairs({ "SetAllPoints", "SetTexture", "SetTexCoord" }) do texture[method] = function() end end
            return texture
        end
        for _, method in ipairs({ "SetSize", "SetPoint", "SetFrameStrata", "SetBackdrop",
            "SetBackdropColor", "EnableKeyboard", "SetPropagateKeyboardInput", "ClearAllPoints" }) do
            frame[method] = function() end
        end
        client.widgets[#client.widgets + 1] = frame
        return frame
    end
    ns.AddPanelText = function()
        return { SetPoint = function() end, SetText = function() end }
    end
    ns.EnforceSnapshotGuild = function() end
    ns.LoadSnapshot = function() end
    env.C_NamePlate = { GetNamePlateForUnit = function(unit)
        return unit == "nameplate1" and client.units[unit] and client.units[unit].plate or nil
    end }
    env.SetRaidTarget = function() error("Protected raid marking must never be called") end
    for _, module in ipairs({ "KillListEntryPoints", "KillObservations", "KillObservationSync",
        "KillDetection", "KillAlerts", "KillBattles", "KillListBridge" }) do
        local chunk = assert(loadfile("apps/addon/FlockSync/" .. module .. ".lua"))
        setfenv(chunk, env)("FlockSync", ns)
    end
    ns.SetKillSetting("enabled", true)
    return client
end
function net:addTarget(client, name, personal)
    local destination = personal and "personal" or "shared"
    local key = "realm\031" .. name:lower()
    client.ns.KillStore(destination)[key] = {
        name = name, realm = "Realm", author = "Member One", authorGuid = "P1",
        actorGuid = "P1", createdAt = 90, updatedAt = 90, note = "Local note",
        sharedLive = not personal, deleted = false,
    }
    return { key = key, destination = destination, entry = client.ns.KillStore(destination)[key] }
end
return net
