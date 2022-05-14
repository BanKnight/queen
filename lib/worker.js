const { deserialize, serialize } = require('v8');
const { EventEmitter } = require('events');

let workerData = null
let parentPort = null

let id = null          //ant id的起始
let config = null
let workers = {}
let ants = {}
let names = {}

let session = 0
let rpcs = {}
let plugins = null

let QUEEN = Symbol("QUEEN")
let SELF = Symbol("SELF")

module.exports = function (context)
{
    workerData = context.workerData
    parentPort = context.parentPort

    config = workerData.config

    id = workerData.index << 24

    plugins = require('./plugins')(config);

    parentPort.on('message', on_message.bind(QUEEN));
}

function new_id(force_id)
{
    if (force_id)
    {
        return force_id
    }

    while (++id)
    {
        if (!ants[id])
        {
            return id
        }
    }
}

function clone(target)
{
    return deserialize(serialize(target))
}

function worker_index(id)
{
    return (id >> 24) % config.workers
}

function on_message(event)
{
    if (config.debug)
    {
        console.log(`worker[${workerData.index}]:on_message`, this.index != null ? this.index : this, event)
    }

    switch (event.type)
    {
        case "connect": on_connect(this, event); break;
        case "start": on_start(this, event); break
        case "call": on_call(this, event); break;
        case "post": on_post(this, event); break            //要求发给某个ant
        case "broad": on_broad(this, event); break          //广播给所有的ant
        case "destroy": on_destroy(this, event); break
        case "regist": on_regist(this, event); break        //注册一个名字
        case "unregist": on_unregist(this, event); break    //反注册一个名字
        case "response": on_response(this, event); break;   //收到一个响应
        default: on_unknown(this, event); break;
    }
}

function on_connect(queen, event)
{
    let index = event.index
    let port = event.port

    let worker = {
        index,
        port,
    }

    workers[index] = worker

    port.on('message', on_message.bind(worker))
}

async function on_start(queen, event)
{
    if (config.agent == null)
    {
        return
    }

    try
    {
        await spawn(config.agent.template, config.agent.args, config.agent.meta || {})
    }
    catch (error)
    {
        if (config.debug)
        {
            console.error(`spawn agent error:`, error)
        }
    }
}

function on_call(worker, event)
{
    switch (event.name)
    {
        case "spawn": on_spawn(worker, event); break;
        default: on_unknown(worker, event); break;
    }
}
/**
 * 通过名字注册
 * @param {} worker 
 * @param {*} event 
 */
function on_regist(worker, event)
{
    let { name, id } = event

    regist(name, id)
}
/**
 * 反注册名字
 * @param {*} worker 
 * @param {*} event 
 */
function on_unregist(worker, event)
{
    let { name, id } = event

    unregist(name, id)
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
function on_post(worker, event)
{
    const { from, target, name, args } = event

    post(target, from, name, ...args)
}

/**
 * 广播给本地ants
 * @param {*} worker 
 * @param {*} event 
 */
function on_broad(worker, event)
{
    const { from, name, args } = event

    broad(from, name, ...args)
}

function on_unknown(event)
{

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
 * 
 * @param {*} worker 
 * @param {*} event 
 */
function on_destroy(worker, event)
{
    let id = event.id

    destroy(id)
}
//------------------------------------------

/**
 * 
 * @param {Object} worker 
 * @param {int} session 
 * @param {any} result 
 * @param {Error} error 
 */
function response(worker, session, result, error)
{
    send(worker, {
        type: "response",
        session: session,
        result: result,
        error: error
    })
}

/**
 * 作为底层的发送接口
 * @param {Object} worker 
 * @param {Object} event 
 */
function send(worker, event)
{
    if (worker == QUEEN)
    {
        parentPort.postMessage(event)
    }
    else if (worker == SELF)
    {
        const clone_event = clone(event)

        setImmediate(on_message.bind(SELF), clone_event)
    }
    else
    {
        worker.port.postMessage(event)
    }
}
/**
 * 广播给所有的worker
 * @param {Object} event 
 * @param {Boolean} include_self 
 */
function send_all(event, include_self = false)
{
    for (let index in workers)
    {
        let worker = workers[index]
        send(worker, event)
    }

    if (include_self)
    {
        send(SELF, event)
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

    return new Promise(function (resolve, reject)
    {
        rpcs[session] = {
            session: id,
            resolve: resolve,
            reject: reject
        }

        send(worker, {
            type: "call",
            session: id,
            name: name,
            args: args
        })
    })
}

/**
 * 本地创建一个ant
 * @param {String} template 
 * @param {Any} args 
 * @param {Object} meta
 * @returns {Object} ant
 */
function spawn(template, args, meta = {})
{
    if (config.debug)
    {
        console.log("spawn", template, args, meta)
    }

    let entry = plugins.load(template)

    if (entry == null)
    {
        throw new Error("template not found:" + template)
    }

    let ant_id = new_id(meta.id)
    let ant = new_ant(ant_id, template, args, meta)

    ants[ant.id] = ant

    entry(ant)

    if (ant.name)
    {
        gregist(ant.name, ant.id)
    }

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
    let meta = args[2] || {}
    let { id } = meta

    let worker_index = 0

    if (id == null)
    {
        worker_index = Math.floor(Math.random() * config.workers)
    }
    else
    {
        worker_index = (id >> 24) % config.workers
    }

    if (worker_index == workerData.index)
    {
        return call(SELF, "spawn", args)
    }

    let worker = workers[worker_index]

    return call(worker, "spawn", args)
}

/**
 * 摧毁一个本地的ant
 * @param {int} target 
 * @returns 
 */
function destroy(target)
{
    if (config.debug)
    {
        console.log("destroy", target)
    }

    let ant = ants[target]

    if (ant == null)
    {
        return
    }

    delete ants[target]

    ant.emit("exit")

    if (ant.name)
    {
        gunregist(ant.name)
    }
}
/**
 * 全局摧毁一个ant
 * @param {int} target 
 */
function gdestroy(target)
{
    let index = worker_index(target)
    let worker = workers[index]

    const event = {
        type: "destroy",
        id: target,
    }

    if (index == workerData.index)
    {
        send(SELF, event)
    }
    else
    {
        send(worker, event)
    }
}

/**
 * 发送给本地的一个ant的消息
 * @param {int} target ant的id
 * @param {int} from 发送者
 * @param {String} name 
 * @param  {...any} args 
 */
function post(target, from, name, ...args)
{
    if (config.debug)
    {
        console.log("ant post", target, from, name, ...args)
    }

    let ant = ants[target]

    if (typeof target == "string")
    {
        ant = ants[names[target]]
    }

    if (ant)
    {
        ant.emit(name, from, ...args);
    }
    else
    {
        throw new Error("ant not found:" + target)
    }
}

/**
 * 全局发送一个ant的消息
 * @param {int} target ant的id
 * @param {int} from 发送者
 * @param {String} name 
 * @param  {...any} args 
 */
function gpost(target, from, name, ...args)
{
    let index = worker_index(target)
    let worker = workers[index]

    let event = {
        type: "post",
        from,
        target,
        name,
        args
    }

    if (index == workerData.index)
    {
        send(SELF, event)
    }
    else
    {
        send(worker, event)
    }
}

/**
 * 广播给本地的ant
 */
function broad(from, name, ...args)
{
    for (const target in ants)
    {
        try
        {
            post(target, from, name, ...args)
        }
        catch (error)
        {
            console.error(error)
        }
    }
}

/**
 * 广播给所有的ant
 * @param {*} from 
 * @param {*} name 
 * @param  {...any} args 
 */
function gbroad(from, name, ...args)
{
    let event = {
        type: "broad",
        from,
        target,
        name,
        args
    }

    send_all(event, true)
}

function regist(name, target)
{
    names[name] = target

    if (config.debug)
    {
        console.log(`worker[${workerData.index}]`, "regist", name, target)
    }
}

function gregist(name, target)
{
    regist(name, target)

    if (name.startsWith("@"))
    {
        return
    }
    send_all({
        type: "regist",
        name: name,
        id: target
    })
}

function search(name)
{
    return names[name]
}

function unregist(name)
{
    delete names[name]
}

function gunregist(name)
{
    unregist(name)

    if (name.startsWith("@"))
    {
        return
    }
    send_all({
        type: "unregist",
        name: name,
    })
}

function new_ant(id, template, args, meta)
{
    let ant = new EventEmitter()

    ant.id = id
    ant.name = meta.name
    ant.$template = template
    ant.$args = args
    ant.$worker = workerData.index
    ant.$config = workerData.config
    ant.$meta = meta

    ant.spawn = gspawn

    ant.post = (target, name, ...args) =>
    {
        return gpost(target, id, name, ...args)
    }

    ant.destroy = (target) =>
    {
        target = target || id

        return gdestroy(target)
    }

    ant.broad = (...args) =>
    {
        gbroad(id, ...args)
    }
    ant.regist = gregist
    ant.unregist = gunregist
    ant.search = search

    plugins.setup("ant", ant)

    return ant
}