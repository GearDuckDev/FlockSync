local addonName, ns = ...

local function serialize(value)
    local valueType = type(value)
    if valueType == "nil" then
        return "nil"
    elseif valueType == "boolean" or valueType == "number" then
        return tostring(value)
    elseif valueType == "string" then
        return string.format("%q", value)
    elseif valueType ~= "table" then
        error("Unsupported serialized value: " .. valueType)
    end

    -- Pure arrays (recipe id lists can be hundreds long) are sent positionally.
    local count = 0
    for _ in pairs(value) do
        count = count + 1
    end
    if count > 0 and count == #value then
        local items = {}
        for index = 1, count do
            items[index] = serialize(value[index])
        end
        return "{" .. table.concat(items, ",") .. "}"
    end

    local fields = {}
    for key, entry in pairs(value) do
        local encodedKey
        if type(key) == "string" then
            encodedKey = "[" .. string.format("%q", key) .. "]"
        elseif type(key) == "number" then
            encodedKey = "[" .. tostring(key) .. "]"
        else
            error("Unsupported serialized table key")
        end
        fields[#fields + 1] = encodedKey .. "=" .. serialize(entry)
    end
    return "{" .. table.concat(fields, ",") .. "}"
end

local function deserialize(source)
    if type(source) ~= "string" then
        return nil
    end
    local position = 1
    local function skipSpace()
        while source:sub(position, position):match("%s") do
            position = position + 1
        end
    end
    local parseValue
    local function parseString()
        position = position + 1
        local characters = {}
        while position <= #source do
            local char = source:sub(position, position)
            if char == '"' then
                position = position + 1
                return table.concat(characters)
            elseif char == "\\" then
                position = position + 1
                local escaped = source:sub(position, position)
                local escapes = {
                    a = "\a", b = "\b", f = "\f", n = "\n",
                    r = "\r", t = "\t", v = "\v",
                    ["\\"] = "\\", ['"'] = '"', ["\n"] = "\n",
                }
                local decoded = escapes[escaped]
                if decoded then
                    characters[#characters + 1] = decoded
                    position = position + 1
                elseif escaped:match("%d") then
                    local digits = source:sub(position):match("^%d%d?%d?")
                    local byte = tonumber(digits)
                    if not byte or byte > 255 then
                        return nil
                    end
                    characters[#characters + 1] = string.char(byte)
                    position = position + #digits
                else
                    return nil
                end
            else
                characters[#characters + 1] = char
                position = position + 1
            end
        end
        return nil
    end
    local function parseTable()
        local result = {}
        local nextIndex = 1
        position = position + 1
        skipSpace()
        while source:sub(position, position) ~= "}" do
            local key
            if source:sub(position, position) == "[" then
                position = position + 1
                skipSpace()
                key = parseValue()
                skipSpace()
                if source:sub(position, position) ~= "]" then
                    return nil
                end
                position = position + 1
                skipSpace()
                if source:sub(position, position) ~= "=" then
                    return nil
                end
                position = position + 1
            else
                key = nextIndex
                nextIndex = nextIndex + 1
            end
            local value = parseValue()
            if key == nil or value == nil then
                return nil
            end
            result[key] = value
            skipSpace()
            local separator = source:sub(position, position)
            if separator == "," or separator == ";" then
                position = position + 1
                skipSpace()
            elseif separator ~= "}" then
                return nil
            end
        end
        position = position + 1
        return result
    end
    parseValue = function()
        skipSpace()
        local char = source:sub(position, position)
        if char == "{" then
            return parseTable()
        elseif char == '"' then
            return parseString()
        end
        local token = source:sub(position):match("^[%w%.%-]+")
        if not token then
            return nil
        end
        position = position + #token
        if token == "true" then
            return true
        elseif token == "false" then
            return false
        end
        return tonumber(token)
    end
    local ok, value = pcall(parseValue)
    if not ok then
        return nil
    end
    skipSpace()
    if position <= #source then
        return nil
    end
    return value
end

local nextMessageId = 0
function ns.Serialize(value)
    return serialize(value)
end

function ns.Deserialize(value)
    return deserialize(value)
end

function ns.ChunkPayload(payload)
    nextMessageId = nextMessageId + 1
    local messageId = tostring(GetServerTime()) .. "n" .. tostring(nextMessageId)
    local chunkSize = 200
    local total = math.max(1, math.ceil(#payload / chunkSize))
    local chunks = {}
    for index = 1, total do
        local data = payload:sub((index - 1) * chunkSize + 1, index * chunkSize)
        local chunk = messageId .. ":" .. index .. ":" .. total .. ":" .. data
        if #chunk > 240 then
            error("FlockSync message chunk exceeds 240 bytes")
        end
        chunks[index] = chunk
    end
    return messageId, chunks
end

-- sender keeps chunks from different players apart; ttl is the reassembly window.
function ns.ReassembleChunk(chunk, sender, ttl)
    local messageId, part, total, data =
        chunk:match("^(%d+n%d+):(%d+):(%d+):(.*)$")
    part, total = tonumber(part), tonumber(total)
    if not messageId or not part or not total
        or total < 1 or total > 10000 or part < 1 or part > total then
        return nil
    end
    messageId = (sender or "") .. "/" .. messageId
    ns.messageParts = ns.messageParts or {}
    local message = ns.messageParts[messageId]
    if not message then
        message = { total = total, received = 0, parts = {} }
        ns.messageParts[messageId] = message
        C_Timer.After(ttl or 90, function()
            if ns.messageParts[messageId] == message then
                ns.messageParts[messageId] = nil
            end
        end)
    elseif message.total ~= total then
        ns.messageParts[messageId] = nil
        return nil
    end
    if message.parts[part] == nil then
        message.parts[part] = data
        message.received = message.received + 1
    end
    if message.received ~= total then
        return nil
    end
    ns.messageParts[messageId] = nil
    return table.concat(message.parts)
end
