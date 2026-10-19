local addonName, ns = ...

-- Tab strip whose panels are only built the first time their tab is opened.
-- build(host) must return a frame; an optional panel.Refresh() runs on every select.
function ns.CreateTabHost(owner, panelTop)
    local host = { tabs = {}, selected = nil }

    function host.Add(name, label, x, y, width, build)
        local button = CreateFrame("Button", nil, owner, "UIPanelButtonTemplate")
        button:SetSize(width, 22)
        button:SetPoint("TOPLEFT", x, y)
        button:SetText(label)
        button:SetScript("OnClick", function() host.Select(name) end)
        host.tabs[#host.tabs + 1] = { name = name, button = button, build = build }
    end

    local function ensurePanel(tab)
        if not tab.panel then
            local container = CreateFrame("Frame", nil, owner)
            container:SetPoint("TOPLEFT", 0, panelTop)
            container:SetPoint("BOTTOMRIGHT")
            tab.panel = tab.build(container)
            tab.container = container
        end
        return tab.panel
    end

    function host.Select(name)
        local target = host.Find(name)
        if not target or target.hidden then
            target = host.FirstVisible()
        end
        if not target then
            return nil
        end
        name = target.name
        host.selected = name
        for _, tab in ipairs(host.tabs) do
            local active = tab.name == name
            tab.button:SetEnabled(not active)
            if active then
                local panel = ensurePanel(tab)
                tab.container:Show()
                if panel.Refresh then
                    panel.Refresh()
                end
            elseif tab.container then
                tab.container:Hide()
            end
        end
        return name
    end

    function host.Find(name)
        for _, tab in ipairs(host.tabs) do
            if tab.name == name then
                return tab
            end
        end
        return nil
    end

    function host.FirstVisible()
        for _, tab in ipairs(host.tabs) do
            if not tab.hidden then
                return tab
            end
        end
        return nil
    end

    -- Hidden tabs keep any built panel but lose their button and container.
    function host.SetTabShown(name, shown)
        local tab = host.Find(name)
        if not tab then
            return
        end
        tab.hidden = not shown
        tab.button:SetShown(shown)
        if not shown and tab.container then
            tab.container:Hide()
        end
    end

    -- Packs the visible tab buttons left to right in one row.
    function host.LayoutRow(x, y, gap)
        for _, tab in ipairs(host.tabs) do
            if not tab.hidden then
                tab.button:ClearAllPoints()
                tab.button:SetPoint("TOPLEFT", x, y)
                x = x + tab.button:GetWidth() + gap
            end
        end
    end

    -- Refreshes panels that already exist; unbuilt tabs stay unbuilt.
    function host.RefreshBuilt()
        for _, tab in ipairs(host.tabs) do
            if tab.panel and tab.panel.Refresh then
                tab.panel.Refresh()
            end
        end
    end

    function host.IsBuilt(name)
        local tab = host.Find(name)
        return tab ~= nil and tab.panel ~= nil
    end

    return host
end

local windows = {}

-- Movable, Escape-closable window. Only one FlockSync window is shown at a
-- time because they all open at screen centre.
function ns.CreateWindow(name, title, width, height)
    local window = CreateFrame("Frame", name, UIParent, "BasicFrameTemplateWithInset")
    table.insert(UISpecialFrames, name)
    window:SetSize(width, height)
    window:SetPoint("CENTER")
    window:SetMovable(true)
    window:EnableMouse(true)
    window:RegisterForDrag("LeftButton")
    window:SetScript("OnDragStart", window.StartMoving)
    window:SetScript("OnDragStop", window.StopMovingOrSizing)
    window.TitleText:SetText(title)
    window:HookScript("OnShow", function(self)
        for _, other in ipairs(windows) do
            if other ~= self and other:IsShown() then
                other:Hide()
            end
        end
    end)
    windows[#windows + 1] = window
    -- Frames are created shown; callers open them explicitly.
    window:Hide()
    return window
end
