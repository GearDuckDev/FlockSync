local addonName, ns = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:SetScript("OnEvent", function(_, _, loadedAddon)
    if loadedAddon == addonName then
        if type(FlockSyncHelperDB) ~= "table" then
            FlockSyncHelperDB = {}
        end
        if type(FlockSyncHelperDB.culledCharacterGuids) ~= "table" then
            FlockSyncHelperDB.culledCharacterGuids = {}
        end
        if type(FlockSyncHelperDB.isAuthorizedOfficer) ~= "boolean" then
            FlockSyncHelperDB.isAuthorizedOfficer = false
        end
        if type(FlockSyncHelperDB.serverTimestamp) ~= "number" then
            FlockSyncHelperDB.serverTimestamp = 0
        end
    end
end)
