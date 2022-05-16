const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

run({
    workerData: workerData,
    parentPort: parentPort
})

process.on("uncaughtException", function (error)    // 捕获全局异常 
{
    console.log("uncaughtException")
    console.log(error)
})

