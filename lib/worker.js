const { deserialize, serialize } = require('v8');
const Ant = require("./Ant")

let workerData = null
let parentPort = null

let id = null          //ant id的起始
let config = null
let workers = new Map()
let ants = new Map()
let new_ants = []           //新的ant，统一处理emit start
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

    parentPort.on('message', (event) =>
    {
        if (config.debug)
        {
            console.log(`recv_message(queen,${event.type},...)`)
        }

        return on_message(QUEEN, event.type, event.args)
    })
}

//====================================================================================================================
function new_id(force_id)
{
    if (force_id)
    {
        return force_id
    }

    while (++id)
    {
        if (!ants.get(id))
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

//------------------------------------------
/**
 * 作为底层的发送接口
 * @param {Object} worker 
 * @param {Object} event 
 */
function send(worker, event, transfers)
{
    if (typeof worker == "number")
    {
        let index = worker

        if (index == workerData.index)
        {
            send(SELF, event, transfers)
        }
        else
        {
            send(workers.get(index), event, transfers)
        }
    }
    else if (worker == QUEEN)
    {
        parentPort.postMessage(event, transfers)
    }
    else if (worker == SELF)
    {
        const args = clone(event.args)

        setImmediate(on_message, worker, event.type, args)
    }
    else
    {
        worker.port.postMessage(event, transfers)
    }
}
/**
 * 广播给所有的worker
 * @param {Object} event 
 * @param {Boolean} include_self 
 */
function send_all(event, include_self = false)
{
    for (let worker of workers.values())
    {
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

    invoke(worker, "call", {
        id,
        name,
        args
    })

    return new Promise(function (resolve, reject)
    {
        rpcs[session] = {
            resolve: resolve,
            reject: reject
        }
    })
}
/**
 * 
 * @param {*} type 
 * @param {*} args 
 */
function broad(type, args, include_self = false)
{
    send_all({
        type,
        args
    }, include_self)
}

//====================================================================================================================
function on_message(worker, name, args)
{
    if (config.debug)
    {
        console.log(`on_message`, name, args)
    }

    switch (name)
    {
        case "connect": return on_connect(worker, args);
        case "start": return on_start(worker, args);
        case "call": return on_call(worker, args);
        case "spawn": return on_spawn(worker, args);
        case "destroy": return on_destroy(worker, args);
        case "regist": return on_regist(worker, args);        //注册一个名字
        case "unregist": return on_unregist(worker, args);    //反注册一个名字
        case "response": return on_response(worker, args);   //收到一个响应
        case "check": return on_check(worker, args);

        case "invoke_ant": return on_invoke_ant(worker, args);   //要求发给某个ant
        case "broad_ants_method": return on_broad_ants(worker, args);        //广播给所有的ant
        case "trigger_ant": return on_trigger_ant(worker, args);

        default: throw new Error(`unknown message: ${name}`)
    }
}

async function on_call(worker, args_alias)
{
    let { id, name, args } = args_alias

    if (config.debug)
    {
        console.log(`on_call`, name, id)
    }

    try
    {
        let result = await on_message(worker, name, args)

        response(worker, id, result)
    }
    catch (error)
    {
        response(worker, id, null, error)
    }

    //处理因为这次消息而产生的新ant
    while (new_ants.length > 0)
    {
        try
        {
            let first = new_ants.shift()

            first.emit("start")
        }
        catch (error)
        {
            if (config.debug)
            {
                console.error(`emit(start) ant error:`, error)
            }
        }
    }
}

//====================================================================================================================

function on_connect(queen, args)
{
    let { index, port } = args

    let worker = {
        index,
        port,
    }

    workers.set(index, worker)

    port.on('message', (event) =>
    {
        if (config.debug)
        {
            console.log(`on_message(${index},${event.type},...)`)
        }
        return on_message(worker, event.type, event.args)
    })
}

async function on_start(queen)
{
    if (config.agent == null)
    {
        return
    }

    try
    {
        await on_message(queen, "spawn", config.agent)
    }
    catch (error)
    {
        if (config.debug)
        {
            console.error(`spawn agent error:`, error)
        }
    }
}

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

function on_check(worker, args)
{
    if (ants.size > 0)
    {
        console.dir(ants)

        return
    }

    console.log(`exit@all ants destroyed`)
    process.exit(0)
}

/**
 * 调用ant的methods
 * @param {Object} worker 
 * @param {Object} args_alias 
 */
function on_invoke_ant(worker, args_alias)
{
    const { from, target, name, args, context } = args_alias

    let ant = ants.get(target)

    if (typeof target == "string")
    {
        ant = ants.get(names[target])
    }

    if (ant)
    {
        context.from = from

        return ant.handle(name, args, context)
    }
    else
    {
        throw new Error("ant not found:" + target)
    }
}
/**
 * 触发ant身上的函数
 * @param {*} worker 
 * @param {*} args_alias 
 * @returns 
 */
function on_trigger_ant(worker, args_alias)
{
    const { target, name, args } = args_alias

    let ant = ants.get(target)

    if (typeof target == "string")
    {
        ant = ants.get(names[target])
    }

    if (ant)
    {
        return ant[name](args)
    }
    else
    {
        throw new Error("ant not found:" + target)
    }
}

/**
 * 调用本地ant的函数
 * @param {*} worker 
 * @param {*} args_alias 
 */
function on_broad_ants(worker, args_alias)
{
    const { from, name, args } = args_alias

    for (const target of ants.keys()) 
    {
        try
        {
            invoke_ant(target, from, name, args)
        }
        catch (error)
        {
            console.error(error)
        }
    }
}


/**
 * 创建一个spawn
 * 
 * @param {Object} worker 
 * @param {Object} args
 */
function on_spawn(worker, args_alias)
{
    const { template, args, options } = args_alias

    let entry = plugins.load(template)

    if (entry == null || typeof entry != "function")
    {
        throw new Error("template not found:" + template)
    }

    let ant_id = new_id(options.id)
    let ant = new_ant(ant_id, template, args, options)

    ants.set(ant.id, ant)

    entry(ant)

    if (ant.name)
    {
        regist(ant.name, ant.id)
    }

    new_ants.push(ant)

    console.log("==>", ant.id, template, args, options)

    return ant.id
}

/**
 * 
 * @param {*} worker 
 * @param {*} event 
 */
function on_destroy(worker, args)
{
    let { id } = args

    let ant = ants.get(id)

    if (ant == null)
    {
        console.warn("no such ant", id)
        return
    }

    ant.emit("exit")

    ants.delete(id)

    if (ant.name)
    {
        unregist(ant.name)
    }

    console.log("<==", ant.id, ant.template)

    if (ants.size > 0)
    {
        return
    }

    setTimeout(() =>
    {
        if (ants.size > 0)
        {
            return
        }

        console.log(`exit@all ants destroyed`)
        process.exit(0)
    }, 1000)
}

/**
 * 通过名字注册
 * @param {} worker 
 * @param {*} args 
 */
function on_regist(worker, args)
{
    let { name, id } = args

    names[name] = id
}

/**
 * 反注册名字
 * @param {*} worker 
 * @param {*} args 
 */
function on_unregist(worker, args)
{
    let { name } = args

    delete names[name]
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
    invoke(worker, "response", { session, result, error })
}

/**
 * 全局创建ant
 * @param {*} template 
 * @param {*} args 
 * @param {*} options 
 * @returns 
 */
async function spawn(template, args, options = {})
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

    return call(index, "spawn", { template, args, options })
}
/**
 * 全局摧毁一个ant
 * @param {int} target 
 */
function destroy(target)
{
    let index = worker_index(target)

    invoke(index, "destroy", { id: target })
}

/**
 * 远程调用ant的methods函数
 * @param {*} from 
 * @param {*} target 
 * @param {*} name 
 * @param {*} args 
 * @param {*} context 
 */
function invoke_ant(from, target, name, args, context = {})
{
    let index = worker_index(target)

    invoke(index, "invoke_ant", {
        from,
        target,
        name,
        args,
        context
    })
}
/**
 * 调用ant身上的函数
 * @param {*} from 
 * @param {*} target 
 * @param {*} name 
 * @param {*} args 
 * @param {*} context 
 */
function trigger_ant(from, target, name, args, context = {})
{
    let index = worker_index(target)

    invoke(index, "trigger_ant", {
        from,
        target,
        name,
        args,
        context
    })
}

function call_ant(from, target, name, args, context = {})
{
    let index = worker_index(target)

    return call(index, "invoke_ant", {
        from,
        target,
        name,
        args,
        context
    })
}

/**
 * 广播给所有的ant
 * @param {*} from 
 * @param {*} name 
 * @param  {...any} args 
 */
function broad_ants_method(from, name, args)
{
    broad("broad_ants_method", {
        from,
        name,
        args
    }, true)
}

/**
 * 监控ant
 * @param {*} target 
 */
function spy_ant(target)
{
    let index = worker_index(target)

    invoke(index, "spy_ant", {
        from,
        target,
    })
}

function regist(name, id)
{
    let exists = names[name]
    if (exists)
    {
        console.warn("name exists", name, id, exists)
    }

    names[name] = id

    if (name.startsWith("@") == false)
    {
        broad("regist", { name, id })
    }
}

function unregist(name)
{
    delete names[name]

    if (name.startsWith("@") == false)
    {
        broad("unregist", { name })
    }
}

function search(name)
{
    return names[name]
}

function new_ant(id, template, args, options)
{
    let ant = new Ant({
        id,
        template,
        args,
        options,
        worker: workerData.index,
        config: workerData.config,
        name: options.name,
    })

    ant.spawn = spawn
    ant.regist = regist
    ant.unregist = unregist
    ant.search = search

    ant.broad = (name, args) =>
    {
        broad_ants_method(id, name, args)
    }

    ant.send = (target, name, args, context) =>
    {
        invoke_ant(id, target, name, args, context)
    }
    ant.call = (target, name, args, context) =>
    {
        return call_ant(id, target, name, args, context)
    }
    ant.destroy = (target) =>
    {
        target = target || id
        return destroy(target)
    }
    ant.trigger = (target, name, args) =>
    {
        return trigger_ant(id, target || id, name, args)
    }

    // ant.spy = (target) =>
    // {
    //     return spy_ant(target)
    // }

    ant.next_session = () =>
    {
        return ++session
    }

    ant.console = {}

    let names = ["info", "log", "warn", "error", "debug", "trace"]

    for (let key in console)
    {
        if (names.includes(key))
        {
            ant.console[key] = console[key].bind(console, `${ant.template}@ants[${id}]`)
        }
        else
        {
            ant.console[key] = (...args) =>
            {
                console.log(`${ant.template}@ants[${id}]`)
                console[key](...args)
            }
        }
    }

    ant.console.table = console.table

    plugins.setup("ant", ant)

    return ant
}