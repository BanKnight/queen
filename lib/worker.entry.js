const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

process.on("uncaughtException", function (error)    // 捕获全局异常 
{
    console.log("uncaughtException")
    console.log(error)
})

global.old_console = console
global.console = {}

let names = ["info", "log", "warn", "error", "debug", "trace"]

for (let key in old_console)
{
    let old = old_console[key]

    if (names.includes(key))
    {
        console[key] = (...args) =>
        {
            old.call(console, `[${new Date().toLocaleString()}]`, `workers[${workerData.index}]`, ...args)
        }
    }
    else
    {
        console[key] = (...args) =>
        {
            old_console.log(`[${new Date().toLocaleString()}]`, `workers[${workerData.index}]`, ...args)
            old.call(old_console, ...args)
        }
    }
}

run({
    workerData: workerData,
    parentPort: parentPort
})



