local addonName, ns = ...

-- Quest IDs per chain, in completion order. Chains are keyed by faction when the
-- questline differs. Verify/extend these against the Forever client as needed.
local CHAINS = {
    {
        chainId = "ONYXIA",
        name = "Onyxia's Lair",
        steps = {
            Alliance = {
                { questId = 4182, name = "Dragonkin Menace" },
                { questId = 4903, name = "The Great Masquerade" },
                { questId = 4904, name = "Drakefire Amulet" },
            },
            Horde = {
                { questId = 4941, name = "Warlord's Command" },
                { questId = 4974, name = "Eitrigg's Wisdom" },
                { questId = 4975, name = "For The Horde!" },
            },
        },
    },
    {
        chainId = "MC",
        name = "Molten Core",
        steps = {
            Alliance = { { questId = 7848, name = "Attunement to the Core" } },
            Horde = { { questId = 7487, name = "Attunement to the Core" } },
        },
    },
    {
        chainId = "BWL",
        name = "Blackwing Lair",
        steps = {
            Alliance = { { questId = 7761, name = "Blackhand's Command" } },
            Horde = { { questId = 7761, name = "Blackhand's Command" } },
        },
    },
}

local function questDone(questId)
    if C_QuestLog and C_QuestLog.IsQuestFlaggedCompleted then
        return C_QuestLog.IsQuestFlaggedCompleted(questId) == true
    end
    if IsQuestFlaggedCompleted then
        return IsQuestFlaggedCompleted(questId) == true
    end
    return false
end

function ns.ScanAttunements()
    local faction = UnitFactionGroup("player")
    if faction ~= "Alliance" and faction ~= "Horde" then
        faction = "Alliance"
    end
    local timestamp = GetServerTime()
    local result = {}
    for _, chain in ipairs(CHAINS) do
        local steps = {}
        local allDone = true
        for index, step in ipairs(chain.steps[faction]) do
            local completed = questDone(step.questId)
            allDone = allDone and completed
            steps[index] = {
                stepId = index,
                questId = step.questId,
                name = step.name,
                completed = completed,
            }
        end
        result[#result + 1] = {
            chainId = chain.chainId,
            name = chain.name,
            steps = steps,
            isFullyAttuned = allDone,
            updatedAt = timestamp,
        }
    end
    return result
end

-- Newest chain timestamp stands in for the whole list's epoch when merging.
function ns.AttunementsEpoch(chains)
    local newest = 0
    if type(chains) == "table" then
        for _, chain in ipairs(chains) do
            if type(chain) == "table" and type(chain.updatedAt) == "number"
                and chain.updatedAt > newest then
                newest = chain.updatedAt
            end
        end
    end
    return newest
end
