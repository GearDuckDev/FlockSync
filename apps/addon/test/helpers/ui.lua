local widgets, methods = {}, {}
local function widget(parent)
    local result = setmetatable({ scripts = {}, events = {}, visible = true, enabled = true,
        parent = parent, value = 0, textValue = "", width = 0 }, { __index = methods })
    widgets[#widgets + 1] = result
    return result
end
for _, name in ipairs({ "SetAllPoints", "SetHeight", "SetAutoFocus", "SetFontObject", "SetMultiLine",
    "SetFrameStrata", "SetMovable", "EnableMouse", "RegisterForDrag", "StartMoving", "StopMovingOrSizing",
    "SetJustifyH", "SetOrientation", "SetThumbTexture", "SetColorTexture", "SetMinMaxValues",
    "SetValueStep", "SetObeyStepOnDrag", "EnableMouseWheel", "SetSpacing", "ClearFocus", "SetMaxBytes",
    "SetBackdropColor", "SetBackdropBorderColor", "EnableKeyboard", "SetPropagateKeyboardInput" }) do
    methods[name] = function() end
end
function methods:SetScript(event, callback) self.scripts[event] = callback end
function methods:HookScript(event, callback)
    local previous = self.scripts[event]
    self.scripts[event] = function(...) if previous then previous(...) end; callback(...) end
end
function methods:RegisterEvent(event) self.events[event] = true end
function methods:SetPoint(...) self.point = { ... } end
function methods:ClearAllPoints() self.point = nil end
function methods:SetSize(width, height) self.width, self.height = width, height end
function methods:SetWidth(width) self.width = width end
function methods:GetHeight() return self.height or 0 end
function methods:SetBackdrop(value) self.backdrop = value end
function methods:SetFrameLevel(value) self.frameLevel = value end
function methods:GetFrameLevel() return self.frameLevel or 1 end
function methods:SetFocus() self.focused = true end
function methods:GetWidth() return self.width end
function methods:SetText(text)
    self.textValue = text
    if self.scripts.OnTextChanged then self.scripts.OnTextChanged(self) end
end
function methods:GetText() return self.textValue end
function methods:SetChecked(value) self.checked = value and true or false end
function methods:GetChecked() return self.checked == true end
function methods:SetEnabled(value) self.enabled = value and true or false end
function methods:IsEnabled() return self.enabled end
function methods:Show() self.visible = true end
function methods:Hide() self.visible = false end
function methods:IsShown() return self.visible end
function methods:IsVisible() return self.visible and (not self.parent or self.parent:IsVisible()) end
function methods:SetShown(value) self.visible = value end
function methods:CreateFontString() return widget(self) end
function methods:CreateTexture() return widget(self) end
function methods:GetThumbTexture() return widget(self) end
function methods:SetScrollChild(child) self.scrollChild = child end
function methods:GetValue() return self.value end
function methods:SetValue(value)
    self.value = value
    if self.scripts.OnValueChanged then self.scripts.OnValueChanged(self, value) end
end
UIParent = widget()
UISpecialFrames, StaticPopupDialogs, SlashCmdList = {}, {}, {}
YES, NO = "Yes", "No"
function CreateFrame(kind, name, parent)
    local result = widget(parent)
    result.kind, result.globalName = kind, name
    result.TitleText, result.text = widget(result), widget(result)
    return result
end
local function click(button)
    assert(button:IsEnabled(), "Cannot click disabled control")
    if button.scripts.OnClick then button.scripts.OnClick(button) end
end
local function find(predicate)
    for _, value in ipairs(widgets) do if predicate(value) then return value end end
    error("Widget not found")
end
local function fire(event, ...)
    for _, value in ipairs(widgets) do
        if value.events[event] and value.scripts.OnEvent then value.scripts.OnEvent(value, event, ...) end
    end
end
return { widgets = widgets, click = click, find = find, fire = fire }
