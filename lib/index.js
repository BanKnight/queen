const path = require('path');
const { Worker, MessageChannel, SHARE_ENV } = require('worker_threads');
const defaultConfig = require('./config.default')

const workers = []

let session = 0
let rpcs = {}
let config = null

async function run(cfg)
{
    config = Object.assign({}, defaultConfig, cfg)

    const count = config.workers

    const worker_path = path.join(__dirname, "worker.entry.js")

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

        worker.on('error', on_error.bind(worker))
        worker.on('exit', on_exit.bind(worker))

        worker.on('message', (event) =>
        {
            if (config.debug)
            {
                console.log(`queen:recv_message`, i, event)
            }

            return on_message(worker, event.type, event.args)
        })

        workers.push(worker)
    }

    connect()

    start()

    spawn(config.boot.template, config.boot.args, config.boot.options)

    process.on("uncaughtException", function (error)    // 捕获全局异常 
    {
        console.error("queen:uncaughtException", error)
    })
}

//------------------------------------------
/**
 * 作为底层的发送接口
 * @param {Object} worker 
 * @param {Object} event 
 */
function send(worker, event, transfers)
{
    if (worker)
    {
        worker.postMessage(event, transfers)
    }
}

/**
 * 广播给所有的worker
 * @param {Object} event 
 */
function send_all(event)
{
    for (let worker of workers)
    {
        send(worker, event)
    }
}

/**
 * 底层的远程调用接口
 * @param {*} worker 
 * @param {String} type 
 * @param {*} args 
 * @param {*} transfers
 */
function invoke(worker, type, args, ...transfers)
{
    send(worker, {
        type,
        args
    }, transfers)
}

/**
 * 底层的远程调用接口
 * @param {*} worker 
 * @param {*} name 
 * @param {*} args 
 * @returns 
 */
function call(worker, name, args)
{
    let id = ++session

    invoke(worker, "call", [id, name, args])

    return new Promise(function (resolve, reject)
    {
        rpcs[session] = {
            resolve: resolve,
            reject: reject
        }
    })
}

function on_error(event)
{
    console.log(`queen:on_error(workers[${this.index}])`)
    console.log(event)
}

function on_exit(event)
{
    console.log(`queen:on_exit(workers[${this.index}])`)

    workers[this.index] = false

    for (const worker of workers)
    {
        if (worker && worker !== this)
        {
            invoke(worker, "check")
            return
        }
    }

    console.log("queen:exit@all workers exit")
    process.exit(0)
}

function on_message(worker, name, args)
{
    if (config.debug)
    {
        console.log(`queen:on_message`, name)
    }
    switch (name)
    {
        case "call": return on_call(worker, args);;
        case "response": return on_response(worker, args);;
        default: throw new Error(`unknown message: ${name}`)
    }
}

//====================================================================================================================
async function on_call(worker, args_alias)
{
    let { id, name, args } = args_alias

    try
    {
        let result = await on_message(worker, name, args)

        response(worker, id, result)
    }
    catch (error)
    {
        response(worker, id, null, error)
    }
}

//====================================================================================================================

function on_response(worker, args)
{
    const id = args.session
    const rpc = rpcs[id]

    delete rpcs[id]

    if (args.error)
    {
        rpc.reject(args.error)
    }
    else
    {
        rpc.resolve(args.result)
    }
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

            invoke(first, "connect", {
                index: j,
                port: channel.port1
            }, channel.port1)

            invoke(second, "connect", {
                index: i,
                port: channel.port2
            }, channel.port2)
        }
    }
}

function start()
{
    for (let i = 0; i < workers.length; i++)
    {
        const first = workers[i]

        invoke(first, "start")
    }
}

/**
 * 底层的远程调用接口
 * @param {*} worker 
 * @param {*} name 
 * @param {*} args 
 * @returns 
 */
function call(worker, name, args)
{
    let id = ++session

    invoke(worker, "call", {
        id,
        name,
        args
    })
    return new Promise(function (resolve, reject)
    {
        rpcs[id] = {
            id: id,
            resolve: resolve,
            reject: reject
        }
    })
}

function response(worker, session, result, error)
{
    invoke(worker, "response", { session, result, error })
}

/**
 * 
 * @param {*} template 
 * @param {*} args 
 * @param {*} options 
 * @returns 
 */
function spawn(template, args, options = {})
{
    let { id } = options

    let index = Math.floor(Math.random() * config.workers)

    if (id != null)
    {
        index = (id >> 24) % config.workers
    }
    else if (options.index != null)
    {
        index = options.index
    }

    let worker = workers[index]

    return call(worker, "spawn", { template, args, options })
}

module.exports.run = run