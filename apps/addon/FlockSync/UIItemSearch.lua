local addonName, ns = ...

function ns.AttachGoalItemSearch(box, onSelect)
    local popup = CreateFrame("Frame", nil, box, "BackdropTemplate")
    popup:SetPoint("TOPLEFT", box, "BOTTOMLEFT", -4, -2)
    popup:SetSize(330, 28)
    popup:SetFrameStrata("TOOLTIP")
    popup:SetFrameLevel(box:GetFrameLevel() + 10)
    popup:SetBackdrop({
        bgFile = "Interface\\Tooltips\\UI-Tooltip-Background",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 16, edgeSize = 12,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
    })
    popup:SetBackdropColor(0.05, 0.05, 0.08, 1)
    popup:EnableMouse(true)
    popup:Hide()
    local buttons = {}
    local hint = popup:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    hint:SetPoint("TOPLEFT", 8, -8)
    hint:SetWidth(314)
    hint:SetJustifyH("LEFT")
    for index = 1, 6 do
        local button = CreateFrame("Button", nil, popup)
        button:SetPoint("TOPLEFT", 6, -5 - (index - 1) * 24)
        button:SetSize(318, 24)
        button:SetHighlightTexture("Interface\\QuestFrame\\UI-QuestTitleHighlight")
        button.text = button:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        button.text:SetPoint("LEFT", 4, 0)
        button.text:SetWidth(310)
        button.text:SetJustifyH("LEFT")
        button:SetScript("OnClick", function(self)
            popup:Hide()
            onSelect(self.item)
            box:ClearFocus()
        end)
        buttons[index] = button
    end
    local function update()
        if not box:HasFocus() then return end
        local text = box:GetText()
        if #text < 2 or ns.ParseItemInput(text) then
            popup:Hide()
            return
        end
        local matches = ns.FindGoalItems(text)
        for index, button in ipairs(buttons) do
            local item = matches[index]
            button.item = item
            button:SetShown(item ~= nil)
            if item then
                button.text:SetText(item.name .. " (#" .. item.itemId .. ")")
            end
        end
        hint:SetShown(#matches == 0)
        hint:SetText("No known matches. Try an item ID, link, or drag an item.")
        popup:SetHeight(#matches == 0 and 40 or 10 + #matches * 24)
        popup:Show()
    end
    box:HookScript("OnEditFocusGained", function()
        ns.RefreshItemSearch()
        update()
    end)
    local generation = 0
    box:HookScript("OnTextChanged", function(_, userInput)
        generation = generation + 1
        if not userInput then
            popup:Hide()
            return
        end
        local current = generation
        C_Timer.After(0.15, function()
            if current == generation then update() end
        end)
    end)
    box:HookScript("OnEditFocusLost", function()
        C_Timer.After(0.2, function()
            if not box:HasFocus() then popup:Hide() end
        end)
    end)
    box:HookScript("OnHide", function() popup:Hide() end)
end
