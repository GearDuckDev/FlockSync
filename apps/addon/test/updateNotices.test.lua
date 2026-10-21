if not UPDATE_NOTICES_SOURCE then
    local f = assert(io.open("apps/addon/FlockSync/UpdateNotices.lua", "rb"))
    UPDATE_NOTICES_SOURCE = f:read("*a")
    f:close()
end

local frames, output = {}, {}
local installed = "0.2.0"
local ns = { GetAddonVersion = function() return installed end }
local realCreateFrame, realPrint = CreateFrame, print
CreateFrame = function()
    local frame = {}
    function frame:RegisterEvent(event) self.event = event end
    function frame:SetScript(_, callback) self.callback = callback end
    frames[#frames + 1] = frame
    return frame
end
print = function(message) output[#output + 1] = message end

-- The runner supplies the production module source without using WoW's sandboxed I/O.
assert(loadstring or load)(UPDATE_NOTICES_SOURCE)("FlockSync", ns)

local function catalog(release, beta, alpha)
    return {
        release = release and { version = release },
        beta = beta and { version = beta },
        alpha = alpha and { version = alpha },
    }
end
local function login(version, releases)
    installed = version
    FlockSyncDB = {}
    frames, output = {}, {}
    assert(loadstring or load)(UPDATE_NOTICES_SOURCE)("FlockSync", ns)
    ns.CacheAddonReleases(releases)
    frames[1].callback(nil, "PLAYER_ENTERING_WORLD", false, true)
    frames[1].callback(nil, "PLAYER_ENTERING_WORLD", false, false)
    assert(#output == 0, "UI reloads and zone transitions must not check")
    frames[1].callback(nil, "PLAYER_ENTERING_WORLD", true)
end

login("0.2.0", catalog(nil, "0.3.0-beta", "0.4.0-alpha"))
assert(#output == 0, "Stable installs must not see previews")
login("0.2.0", catalog("0.3.0", "0.4.0-beta", "0.5.0-alpha"))
assert(#output == 1 and output[1]:find("v0.3.0 is available", 1, true))
frames[1].callback(nil, "PLAYER_ENTERING_WORLD", true)
assert(#output == 1, "Repeated events must not print again")
ns.CacheAddonReleases(catalog("0.4.0", nil, nil))
assert(#output == 1, "Metadata received mid-session must not print")
assert(FlockSyncDB.addonReleases.release == "0.4.0")
ns.CacheAddonReleases(catalog("0.3.0", nil, nil))
assert(FlockSyncDB.addonReleases.release == "0.4.0", "Older cache must not replace newer")
login("0.2.0-beta", catalog("0.2.0", "0.3.0-beta.10", "0.4.0-alpha"))
assert(#output == 1 and output[1]:find("v0.3.0-beta.10 is available", 1, true))
login("0.2.0-alpha.2", catalog(nil, nil, "0.2.0-alpha.10"))
assert(#output == 1 and output[1]:find("v0.2.0-alpha.10 is available", 1, true))
login("0.2.0-alpha", catalog("0.2.0", nil, nil))
assert(#output == 1, "Alpha installs must see stable promotion")
login("0.2.0-beta.10", catalog(nil, "0.2.0-beta.2", nil))
assert(#output == 0, "Older prerelease must not notify")
login("0.2.0", catalog(nil, nil, nil))
assert(#output == 0, "Missing metadata must stay quiet")
ns.CacheAddonReleases({
    release = { version = "0.3.0-alpha" }, beta = { version = "|cffff0000bad" },
    alpha = { version = "1.0.0-alpha.01" },
})
assert(next(ns.CompactAddonReleases()) == nil, "Malformed or mismatched channels must be rejected")
FlockSyncDB.addonReleases.release = "corrupted"
ns.CacheAddonReleases(catalog("0.3.0", nil, nil))
assert(FlockSyncDB.addonReleases.release == "0.3.0", "Valid metadata must repair malformed saved cache")
login("0.2.0", catalog("9.0.0\nbad", nil, nil))
assert(#output == 0, "Malformed metadata must not appear in chat")
login("unknown", catalog("0.3.0", nil, nil))
assert(#output == 0, "An unknown installed version cannot be compared")
installed = "0.2.0"
frames[1].callback(nil, "PLAYER_ENTERING_WORLD", false, true)
assert(#output == 0, "UI reload must not trigger a check")

local realAddOns = C_AddOns
local helperInstalled = "0.2.1-beta"
C_AddOns = { GetAddOnMetadata = function(name, key)
    assert(name == "FlockSync_AppHelper" and key == "Version")
    return helperInstalled
end }
FlockSyncHelperDB = { helperReleases = catalog(nil, "0.2.2-beta", "0.3.0-alpha") }
login("0.3.2-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 1 and output[1]:find("FlockSync AppHelper:", 1, true))
assert(output[1]:find("v0.2.2-beta", 1, true), "Helper compares its own version")
assert(output[1]:find("github.com/GearDuckDev/FlockSync/releases", 1, true))
frames[1].callback(nil, "PLAYER_ENTERING_WORLD", true)
frames[1].callback(nil, "PLAYER_ENTERING_WORLD", false, true)
assert(#output == 1, "Helper notice must occur once, not on reload")
login("0.3.1-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 2, "Main addon and helper must independently notify when both are outdated")
helperInstalled = "0.2.2-beta"
login("0.3.2-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 0, "Current helper must stay quiet even with an alpha available")
helperInstalled = "0.2.0"
login("0.3.2-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 0, "Stable helper must ignore beta and alpha")
helperInstalled = "0.2.0-alpha"
login("0.3.2-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 1 and output[1]:find("v0.3.0-alpha", 1, true))
FlockSyncHelperDB = nil
login("0.3.2-beta", catalog(nil, "0.3.2-beta", nil))
assert(#output == 0, "Members without AppHelper must never see helper notices")
C_AddOns = realAddOns
CreateFrame, print = realCreateFrame, realPrint
FlockSyncDB = nil
print("Addon update notices: passed")
