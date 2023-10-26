local WS_URL = "ws://localhost:1001"
local TIMER_DELAY = 1

local shouldBroadcast = true

local ws = http.websocket(WS_URL)

local bridge = peripheral.find("meBridge")
assert(bridge, "Unable to find me bridge peripheral")

local timerId = os.startTimer(TIMER_DELAY)

function initDB(dbName, opts)
    local onChange = opts.onChange
    local default = opts.default or {}

    local fileName = "db/" .. dbName .. ".json"

    if not fs.exists(fileName) then
        local file = fs.open(fileName, "w")

        if type(default) == "string" then
            file.write(default)
        else
            file.write(textutils.serializeJSON(default))
        end

        file.close()
    end

    return {
        getAll = function()
            local file = fs.open(fileName, "r")
            local json = textutils.unserializeJSON(file.readAll())

            file.close()

            return json
        end,
        get = function(key)
            local file = fs.open(fileName, "r")
            local json = textutils.unserializeJSON(file.readAll())

            file.close()

            return json[key]
        end,
        set = function(key, value)
            local file = fs.open(fileName, "r")
            local json = textutils.unserializeJSON(file.readAll())

            file.close()

            json[key] = value

            file = fs.open(fileName, "w")

            file.write(textutils.serializeJSON(json))
            file.close()

            if onChange ~= nil then
                onChange(json)
            end
        end
    }
end

local itemLimits = initDB("limits", {
    onChange = function(newData)
        ws.send(textutils.serializeJSON({
            type = "updateLimits",
            limits = newData
        }))
    end
})

local config = initDB("config", {
    default = {
        trashDirection = "top"
    }
})

local trashDirection = config.get("trashDirection")

function handleTimerEvent()
    local storedItems = bridge.listItems()

    if (#storedItems == 0) then
        return
    end

    local payload = {
        type = "storedItems",
        storedItems = {}
    }

    for _, v in pairs(storedItems) do
        table.insert(payload.storedItems, #payload.storedItems + 1, {
            id = v.name,
            amount = v.amount,
            displayName = v.displayName,
            fingerprint = v.fingerprint
        })
    end

    ws.send(textutils.serializeJSON(payload))
end

while true do
    local eventData = {os.pullEvent()}
    local eventName = eventData[1]

    if eventName == "timer" and eventData[2] == timerId then
        handleTimerEvent()
        timerId = os.startTimer(TIMER_DELAY)
    end
end
