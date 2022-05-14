const { workerData, parentPort } = require('worker_threads');
const run = require("./worker")

run({
    workerData: workerData,
    parentPort: parentPort
})