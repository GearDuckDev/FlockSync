local addonName, ns = ...

local function text(parent, title, body)
    local heading = ns.AddPanelText(parent, "GameFontNormalLarge", 400)
    heading:SetPoint("TOPLEFT", 22, -10)
    heading:SetText(title)
    local description = ns.AddPanelText(parent, "GameFontHighlight", 400)
    description:SetPoint("TOPLEFT", 22, -42)
    description:SetText(body)
end

function ns.BuildWalkthroughCrafting(page)
    text(page, "Crafting & Accepting Orders",
        "Let guildmates know they can ask you to craft. Accepting Orders starts on "
        .. "for characters without a saved choice; you can turn it off below.\n\n"
        .. "Open each profession window after setup so FlockSync can learn your recipes. "
        .. "This shares your crafting availability, not an automated order or trade.\n\n"
        .. "Change it anytime in /fs prof using Accepting Guild Crafting Requests.")
    local box = CreateFrame("CheckButton", nil, page, "UICheckButtonTemplate")
    box:SetPoint("TOPLEFT", 20, -245)
    box.text:SetText("Accepting Orders (guild crafting requests)")
    box:SetScript("OnClick", function(self)
        ns.SetAcceptingRequests(self:GetChecked() == true)
    end)
    function page.Refresh() box:SetChecked(ns.GetProfile().acceptingRequests == true) end
end

function ns.BuildWalkthroughAvailability(page)
    text(page, "When Can You Play?",
        "Help officers plan raids, dungeons and PvP around your availability.\n\n"
        .. "After Finish, use /fs availability to choose your timezone, usual start/end "
        .. "hours and each day's REGULAR, OCCASIONAL or UNAVAILABLE status. "
        .. "Click a day to cycle its status.\n\n"
        .. "Availability is shared across your characters on this game account. "
        .. "Unset defaults are not published as your schedule. Setting availability "
        .. "does not sign you up for a group.")
    local box = CreateFrame("CheckButton", nil, page, "UICheckButtonTemplate")
    box:SetPoint("TOPLEFT", 20, -280)
    box.text:SetText("Open availability settings after Finish")
    box:SetScript("OnClick", function(self) page.openAfterFinish = self:GetChecked() == true end)
    page.openAfterFinish = true
    function page.Refresh() box:SetChecked(page.openAfterFinish) end
end

function ns.BuildWalkthroughKillList(page)
    text(page, "Your Kill List",
        "Keep personal enemy-player targets and reasons in a new FlockSync tab. "
        .. "This feature starts off; enable it below if you want to try it.\n\n"
        .. "Shared entries start as local drafts; click Publish to send one to online "
        .. "guildmates. Web views, detection, alerts, skulls and battle history are "
        .. "planned, not active yet. Personal entries never sync.\n\n"
        .. "After setup: /fs kill, /fs kill add [name], or right-click an enemy portrait. "
        .. "Choose Shared, Personal or both before saving.")
    page.Refresh = ns.AddKillToggles(page, -265)
end
