const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

process.on("uncaughtException", function (error)    // 捕获全局异常 
{
    console.error(`workers[${workerData.index}]:uncaughtException`, error)
})

global.old_console = console
global.console = {}

let names = ["info", "log", "warn", "error", "debug", "trace"]
let one_args = ["table", "timeEnd"]
let nooutput = ["time"]

for (let key in old_console)
{
    let old = old_console[key]

    if (names.includes(key))
    {
        console[key] = (...args) =>
        {
            old.call(old_console, `[${new Date().toLocaleString()}]`, `workers[${workerData.index}]`, ...args)
        }
    }
    else if (one_args.includes(key))
    {
        console[key] = (...args) =>
        {
            let last = args.pop()

            console.log(...args)
            old.call(old_console, last)
        }
    }
    else if (nooutput.includes(key))
    {
        console[key] = old_console[key]
        continue
    }
    else
    {
        console[key] = (...args) =>
        {
            old_console.log(`[${new Date().toLocaleString()}]`, `workers[${workerData.index}]`)
            old.call(old_console, ...args)
        }
    }
}

run({
    workerData: workerData,
    parentPort: parentPort
})



