local addonName, ns = ...

local function boundaries(text)
    if type(text) ~= "string" then return nil end
    local ends, index = {}, 1
    while index <= #text do
        local first = text:byte(index)
        local size = first < 128 and 1 or (first >= 194 and first <= 223 and 2)
            or (first >= 224 and first <= 239 and 3) or (first >= 240 and first <= 244 and 4)
        if not size or index + size - 1 > #text then return nil end
        for offset = 1, size - 1 do
            local byte = text:byte(index + offset)
            if byte < 128 or byte > 191 then return nil end
        end
        local second = text:byte(index + 1)
        if (first == 224 and second < 160) or (first == 237 and second > 159)
            or (first == 240 and second < 144) or (first == 244 and second > 143) then return nil end
        index = index + size
        ends[#ends + 1] = index - 1
    end
    return ends
end

function ns.KillTextLength(text)
    local ends = boundaries(text)
    return ends and #ends or nil
end

function ns.ValidateKillAuthor(author)
    local length = ns.KillTextLength(author)
    if not length or length < 1 or length > 80 or author:find("[%c|]") then return nil end
    return author
end

function ns.KillDisplayText(text)
    return (text:gsub("|", "||"))
end

function ns.FormatKillName(name)
    return (name:gsub("%S+", function(part)
        return part:sub(1, 1):upper() .. part:sub(2)
    end))
end

function ns.KillPreview(text)
    local ends = boundaries(text)
    if not ends then return "(invalid text)" end
    return ns.KillDisplayText((#ends > 80 and text:sub(1, ends[77]) .. "..." or text):gsub("[\r\n]", " "))
end

function ns.ValidateKillTarget(name, realm, note)
    if type(name) ~= "string" or type(realm) ~= "string" or type(note) ~= "string" then
        return nil, "Name, realm and reason must be text."
    end
    name, realm = name:match("^%s*(.-)%s*$"), realm:match("^%s*(.-)%s*$")
    local n, r, length = ns.KillTextLength(name), ns.KillTextLength(realm), ns.KillTextLength(note)
    if not n or n < 1 or n > 80 or name:find("[%c|%[%]]")
        or not r or r < 1 or r > 80 or realm:find("[%c|]") then
        return nil, "Enter a player name and realm (1-80 characters each), without links or controls."
    end
    if not length or length > 500 or note:find("[%z\1-\8\11\12\14-\31\127]") then
        return nil, "Reason must be valid text, at most 500 characters."
    end
    name = ns.FormatKillName(name)
    return { name = name, realm = realm, note = note }
end
