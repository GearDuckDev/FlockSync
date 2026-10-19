local addonName, ns = ...

local function say(text)
    print("|cff00c0ffFlockSync:|r " .. text)
end

local HELP = {
    { "/fs", "Open/close the FlockSync window (raids, crafters, LFG, professions)" },
    { "/fs options | config | setup", "Open FlockSync options" },
    { "/fs role | main", "Set this character's role, off-spec and Main" },
    { "/fs prof", "Professions & Gear Goals" },
    { "/fs craft", "Guild Crafter Search" },
    { "/fs raid | schedule", "Your raid schedule" },
    { "/fs minimap", "Show/hide the minimap button" },
    { "/fs debug officer [off]", "Force Officer Mode for this session (testing)" },
    { "/fs help", "Show this list" },
}

local function printHelp()
    local chat = DEFAULT_CHAT_FRAME
    local function line(text)
        if chat then
            chat:AddMessage(text)
        else
            print(text)
        end
    end
    line("|cff00c0ffFlockSync commands:|r")
    for _, entry in ipairs(HELP) do
        line("  |cffffd100" .. entry[1] .. "|r - " .. entry[2])
    end
end

-- Session-only: never saved, so a /reload or relog clears it.
local function setDebugOfficer(enabled)
    ns.debugOfficerOverride = enabled or nil
    ns.RefreshOfficerStatus()
    say(enabled and "Debug officer override ON for this session (/fs debug officer off to disable)."
        or "Debug officer override OFF.")
end

local function openOptions()
    ns.OpenOptions()
end

local function openRole()
    ns.OpenOptions("role")
end

local function openSchedule()
    ns.OpenFeatures("schedule")
end

local ROUTES = {
    [""] = function() ns.ToggleFeatures() end,
    options = openOptions,
    config = openOptions,
    setup = openOptions,
    role = openRole,
    main = openRole,
    prof = function() ns.OpenFeatures("professions") end,
    craft = function() ns.OpenFeatures("crafters") end,
    raid = openSchedule,
    schedule = openSchedule,
    help = printHelp,
    minimap = function()
        ns.SetConfigToggle("showMinimap", not ns.IsEnabled("showMinimap"))
    end,
}

function ns.HandleSlashCommand(msg)
    local words = {}
    for word in string.gmatch(string.lower(msg or ""), "%S+") do
        words[#words + 1] = word
    end
    -- Until the walkthrough is finished, every command opens it.
    if not ns.IsOnboarded() then
        ns.OpenWalkthrough()
        return
    end
    local command = words[1] or ""
    if command == "debug" then
        if words[2] == "officer" then
            setDebugOfficer(words[3] ~= "off")
        else
            say("Usage: /fs debug officer [off]")
        end
        return
    end
    local route = ROUTES[command]
    if route then
        route()
    else
        say("Unknown command '" .. command .. "'.")
        printHelp()
    end
end

SLASH_FLOCKSYNC1 = "/flocksync"
SLASH_FLOCKSYNC2 = "/fs"
SlashCmdList.FLOCKSYNC = ns.HandleSlashCommand
