const path = require('path');
const { EventEmitter } = require('events');
const { workerData, parentPort, BroadcastChannel } = require('worker_threads');

let workers = []
let ants = {}
let id = workerData.index * 100000000          //ant id的起始
let config = workerData.config

let session = 0
let rpcs = {}

let QUEEN = Symbol("QUEEN")

function run()
{
    parentPort.on('message', on_message.bind(QUEEN));
}

run()

function on_message(event)
{
    if (config.debug)
    {
        console.log(`worker[${workerData.index}]:on_message`, this, event)
    }

    switch (event.type)
    {
        case "connect": on_connect(this, event); break;
        case "call": on_call(this, event); break;
        case "send": on_send(this, event); break
        case "response": on_response(this, event); break;
        default: on_unknown(this, event); break;
    }
}

function on_connect(queen, event)
{
    let id = event.id
    let port = event.port

    let worker = {
        id: id,
        port: port,
    }

    workers[id] = worker

    port.on('message', on_message.bind(worker))
}

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

/**
 * 要求发给某个ant
 * @param {Object} worker 
 * @param {event} event 
 */
function on_send(worker, event)
{
    let from = event.from
    let target = event.target
    let name = event.name
    let args = event.args

    let ant = ants[target]

    if (ant)
    {
        ant.emit(name, from, ...args);
    }
    else
    {
        throw new Error("ant not found:" + target)
    }
}

function on_unknown(event)
{

}

//------------------------------------------

/**
 * 作为底层的发送接口
 * @param {Object} worker 
 * @param {Object} event 
 */
function post(worker, event)
{
    if (worker == QUEEN)
    {
        // console.log("post to queen", event)
        parentPort.postMessage(event)
    }
    else
    {
        // console.log("post to worker", worker.index, event)
        worker.port.postMessage(event)
    }
}

/**
 * 
 * @param {Object} worker 
 * @param {int} session 
 * @param {any} result 
 * @param {Error} error 
 */
function response(worker, session, result, error)
{
    post(worker, {
        type: "response",
        session: session,
        result: result,
        error: error
    })
}

function call(worker, name, args)
{
    let id = ++session

    return new Promise(function (resolve, reject)
    {
        rpcs[session] = {
            session: id,
            resolve: resolve,
            reject: reject
        }

        post(worker, {
            type: "call",
            session: id,
            name: name,
            args: args
        })
    })
}


/**
 * 接收到主线程发过来的on_spawn
 * 
 * @param {Object} worker 
 * @param {Object} event event
 */
function on_spawn(worker, event)
{
    let template = event.args[0]
    let args = event.args[1]

    try
    {
        let ant = spawn(template, args)

        response(worker, event.session, ant.id)

        ant.emit("start")           //利用这种方式，拆分掉ant.entry的职责
    }
    catch (error)
    {
        response(worker, event.session, null, error)
    }
}

/**
 * 本地创建一个ant
 * @param {String} template 
 * @param {Array} args 
 * @returns {Object} ant
 */
function spawn(template, args)
{
    let search = config.search
    let file = path.join(search, template)

    let ant = new_ant(++id, template, args)

    let entry = require(file)

    ants[ant.id] = ant

    entry(ant)

    return ant
}

/**
 * 在本进程的某个worker中创建一个ant
 * @param {String} template 
 * @param {Array} args 
 * @returns 
 */
function gspawn(template, args)
{
    return call(QUEEN, "spawn", {
        template: template,
        args: args
    })
}

function new_ant(id, template, args)
{
    let ant = new EventEmitter()

    ant.id = id
    ant.template = template
    ant.args = args
    ant.worker = workerData.index

    ant.post = post_ant.bind(ant)
    ant.spawn = gspawn

    return ant
}

function post_ant(target, name, ...args)
{
    let index = Math.floor(target / 100000000)
    let worker = workers[index]

    if (index == workerData.index)
    {
        setImmediate(on_send, worker, {
            type: "send",
            from: this.id,
            target: target,
            name,
            args
        })
    }
    else
    {
        post(worker, {
            type: "send",
            from: this.id,
            target: target,
            name,
            args
        })
    }
}
