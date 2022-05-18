const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

process.on("uncaughtException", function (error)    // 捕获全局异常 
{
    console.log("uncaughtException")
    console.log(error)
})

global.old_console = {}

let names = ["info", "log", "warn", "error", "debug", "trace", "table"]

const old = global.old_console = {}

for (const name of names)
{
    const func = console[name]
    old[name] = func

    console[name] = function (...args)
    {
        return func.call(console, `[${new Date().toLocaleString()}]`, `workers[${workerData.index}]`, ...args)
    }
}

run({
    workerData: workerData,
    parentPort: parentPort
})



