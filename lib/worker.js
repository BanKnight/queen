const v8 = require('v8');
const { EventEmitter } = require('events');
const { workerData, parentPort } = require('worker_threads');


let workers = []
let ants = {}
let id = workerData.index << 24          //ant id的起始
let config = workerData.config

let session = 0
let rpcs = {}
let plugins = require('./plugins')(config);

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
    const { from, target, name, args } = event

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
    try
    {
        let ant = spawn(...event.args)

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
 * @param {Any} meta
 * @returns {Object} ant
 */
function spawn(template, args, meta)
{
    let ant = new_ant(++id, template, args, meta)

    let entry = plugins.load(template)

    ants[ant.id] = ant

    entry(ant)

    return ant
}

/**
 * 在本进程的某个worker中创建一个ant
 * @param {String} template 
 * @param {Array} args 
 * @param {Object} meta 
 * @returns 
 */
function gspawn(...args)
{
    return call(QUEEN, "spawn", args)
}

function new_ant(id, template, args, meta)
{
    let ant = new EventEmitter()

    ant.id = id
    ant.$template = template
    ant.$args = args
    ant.$worker = workerData.index
    ant.$config = workerData.config
    ant.$meta = meta

    ant.post = ant_post.bind(ant)
    ant.spawn = gspawn

    plugins.setup("ant", ant)

    return ant
}

function ant_post(target, name, ...args)
{
    let index = target >> 24
    let worker = workers[index]

    if (config.debug)
    {
        console.log("ant post", this.$template, target, name, ...args)
    }

    if (index == workerData.index)
    {
        let clone = v8.deserialize(v8.serialize(args))
        setImmediate(on_send, worker, {
            type: "send",
            from: this.id,
            target,
            name,
            args: clone
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
