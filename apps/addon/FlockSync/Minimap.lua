local addonName, ns = ...

-- Native minimap button (no LibDataBroker/LibDBIcon). Position is stored as an
-- angle in degrees around the minimap centre: 0 = east, 90 = north.
local ICON = "Interface\\Icons\\inv_misc_groupneedmore"
local EDGE_OFFSET = 10
local button

local function settings()
    if type(FlockSyncDB.minimap) ~= "table" then
        FlockSyncDB.minimap = {}
    end
    local saved = FlockSyncDB.minimap
    if type(saved.minimapPos) ~= "number" then
        saved.minimapPos = 45
    end
    if type(saved.hide) ~= "boolean" then
        saved.hide = false
    end
    return saved
end

-- Polar -> cartesian: the button sits just outside the minimap's rim.
local function applyPosition(angle)
    local radians = math.rad(angle)
    local radius = Minimap:GetWidth() / 2 + EDGE_OFFSET
    button:ClearAllPoints()
    button:SetPoint("CENTER", Minimap, "CENTER", math.cos(radians) * radius, math.sin(radians) * radius)
end

-- Cartesian -> polar: angle from the minimap centre to the cursor. The cursor
-- is in raw screen pixels, so divide by the minimap's effective scale to match
-- GetCenter()'s coordinate space.
function ns.MinimapAngleFromCursor()
    local centerX, centerY = Minimap:GetCenter()
    local cursorX, cursorY = GetCursorPosition()
    local scale = Minimap:GetEffectiveScale()
    local dx, dy = cursorX / scale - centerX, cursorY / scale - centerY
    return math.deg(math.atan2(dy, dx)) % 360
end

local function onDragUpdate()
    local angle = ns.MinimapAngleFromCursor()
    settings().minimapPos = angle
    applyPosition(angle)
end

local function onClick(_, mouseButton)
    if not ns.IsOnboarded() then
        ns.OpenWalkthrough()
    elseif mouseButton == "RightButton" then
        ns.ToggleOptions()
    else
        ns.ToggleFeatures()
    end
end

local function onEnter(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine("FlockSync")
    GameTooltip:AddLine("Left-click: FlockSync window", 1, 1, 1)
    GameTooltip:AddLine("Right-click: options", 1, 1, 1)
    GameTooltip:AddLine("Drag: move around the minimap", 1, 1, 1)
    GameTooltip:Show()
end

local function createButton()
    button = CreateFrame("Button", nil, Minimap)
    button:SetSize(31, 31)
    button:SetFrameStrata("MEDIUM")
    button:SetFrameLevel(8)
    button:RegisterForClicks("LeftButtonUp", "RightButtonUp")
    button:RegisterForDrag("LeftButton")
    button:SetHighlightTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")

    local background = button:CreateTexture(nil, "BACKGROUND")
    background:SetTexture("Interface\\Minimap\\UI-Minimap-Background")
    background:SetSize(20, 20)
    background:SetPoint("TOPLEFT", 7, -5)

    local icon = button:CreateTexture(nil, "ARTWORK")
    icon:SetTexture(ICON)
    icon:SetSize(17, 17)
    icon:SetPoint("TOPLEFT", 7, -6)
    icon:SetTexCoord(0.05, 0.95, 0.05, 0.95)
    if icon.SetMask then
        icon:SetMask("Interface\\CharacterFrame\\TempPortraitAlphaMask")
    end

    local border = button:CreateTexture(nil, "OVERLAY")
    border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")
    border:SetSize(53, 53)
    border:SetPoint("TOPLEFT")

    button:SetScript("OnClick", onClick)
    button:SetScript("OnEnter", onEnter)
    button:SetScript("OnLeave", function() GameTooltip:Hide() end)
    -- OnUpdate runs only while the user is actively dragging.
    button:SetScript("OnDragStart", function(self)
        self:LockHighlight()
        self:SetScript("OnUpdate", onDragUpdate)
    end)
    button:SetScript("OnDragStop", function(self)
        self:SetScript("OnUpdate", nil)
        self:UnlockHighlight()
        onDragUpdate()
    end)
end

function ns.IsMinimapButtonShown()
    return ns.IsEnabled("showMinimap")
end

-- Called by ns.SetConfigToggle("showMinimap", ...); config.showMinimap is the
-- source of truth and minimap.hide mirrors it.
function ns.SetMinimapButtonShown(shown)
    settings().hide = not shown
    if button then
        button:SetShown(shown)
    end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
    local saved = settings()
    createButton()
    applyPosition(saved.minimapPos)
    ns.SetMinimapButtonShown(ns.IsEnabled("showMinimap"))
end)
