const path = require('path');
const { Worker, MessageChannel, SHARE_ENV } = require('worker_threads');
const defaultConfig = require('./config.default')

const workers = []

let index = -1
let session = 0
let rpcs = {}
let config = null

async function run(cfg)
{
    config = Object.assign({}, defaultConfig, cfg)

    const count = config.workers

    const worker_path = path.join(__dirname, "worker.js")

    for (let i = 0; i < count; i++)
    {
        const worker = new Worker(worker_path, {
            workerData: {
                index: i,
                config: config
            },
            env: SHARE_ENV,
        })

        worker.index = i

        worker.on('message', on_message.bind(worker))
        worker.on('error', on_error.bind(worker))
        worker.on('exit', on_exit.bind(worker))

        workers[i] = worker
    }

    connect()

    await spawn(config.boot.template, config.boot.args, {})
}

function on_message(event)
{
    if (config.debug)
    {
        console.log("queen:on_message", this.index, event)
    }

    switch (event.type)
    {
        case "call": on_call(this, event); break;
        case "response": on_response(this, event); break;

        default: on_unknown(this, event); break;
    }
}

function on_error(event)
{
    console.log("on_error")
    console.log(event)
}

function on_exit(event)
{
    if (config.debug)
    {
        console.log("on_exit")
        console.log(event)
    }

}

//------------------------------------------
function on_call(worker, event)
{
    switch (event.name)
    {
        case "spawn": on_spawn(worker, event); break;
        default: on_unknown(worker, event); break;
    }
}

function on_response(worker, event)
{
    const id = event.session
    const rpc = rpcs[id]

    delete rpcs[id]

    if (event.error)
    {
        rpc.reject(event.error)
    }
    else
    {
        rpc.resolve(event.result)
    }
}

async function on_spawn(worker, event)
{
    try
    {
        const id = await spawn(...event.args)
        response(worker, event.session, id, null)
    }
    catch (error)
    {
        response(worker, event.session, null, error)
    }
}

function on_unknown(worker, event)
{

}

//--------------------------------------------------

function connect()
{
    for (let i = 0; i < workers.length; i++)
    {
        const first = workers[i]

        for (let j = i + 1; j < workers.length; j++)
        {
            let second = workers[j]

            const channel = new MessageChannel()

            first.postMessage({
                type: "connect",
                index: j,
                port: channel.port1
            }, [channel.port1])

            second.postMessage({
                type: "connect",
                index: i,
                port: channel.port2
            }, [channel.port2])
        }
    }
}

async function spawn(...args)
{
    let meta = args[2] || {}
    let { id, name } = meta

    let worker_index = 0

    if (id == undefined)
    {
        index = (++index) % workers.length
        worker_index = index
    }
    else
    {
        worker_index = (id >> 24) % workers.length
    }

    let worker = workers[worker_index]

    id = await call(worker, "spawn", ...args)

    return id
}

function call(worker, name, ...args)
{
    let id = ++session

    return new Promise(function (resolve, reject)
    {
        rpcs[id] = {
            id: id,
            resolve: resolve,
            reject: reject
        }

        worker.postMessage({
            type: "call",
            session: id,
            name: name,
            args: args
        })
    })
}

function response(worker, session, result, error)
{
    worker.postMessage({
        type: "response",
        session: session,
        result: result,
        error: error
    })
}

module.exports.run = run