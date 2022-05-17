const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

process.on("uncaughtException", function (error)    // 捕获全局异常 
{
    console.log("uncaughtException")
    console.log(error)
})

global.old_console = {}

const names = ["info", "log", "warn", "error", "debug", "trace"]
const old = global.old_console = {}

for (const name of names)
{
    const func = console[name]
    old[name] = func

    console[name] = func.bind(console, `workers[${workerData.index}]`)
}

run({
    workerData: workerData,
    parentPort: parentPort
})



