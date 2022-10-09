import { serialize, deserialize } from "v8"
import { parentPort } from 'worker_threads';
import { Loader } from "./Loader.js"
import { Ant } from './Ant.js';
import defaultConfig from "./config.default.js"

function clone(target)
{
    return deserialize(serialize(target))
}

export class WorkerApplication
{
    constructor(config, index)
    {
        this.config = Object.assign({}, defaultConfig, config)
        this.index = index

        this.workers = new Map()

        this.id_helper = index << 24
        this.session = 0
        this.rpcs = {}

        this.loader = new Loader(this, this.config)
        this.ants = new Map()

        this.envs = {}
        this.names = {}
    }

    async start()
    {
        this.config.threads = this.config.threads

        parentPort.on('message', (event) =>
        {
            return this.dispatch(parentPort, event.type, event.args)
        })
    }

    /**
     * 
     * @param {*} env 
     * @param {*} template 
     * @param {*} callback 
     * @returns 
     */
    configure(env, template, callback)
    {
        if (env != "*" && process.env.NODE_ENV != env)
        {
            return
        }

        let exists = this.envs[env]
        if (exists == null)
        {
            exists = this.envs[env] = {}
        }

        exists[template] = callback
    }

    dispatch(from, type, body)
    {
        switch (type)
        {
            case "connect": return this.on_connect(from, body);
            case "check": return this.on_check(from, body)
            case "size": return this.on_size(from, body)
            case "quit": return this.on_quit(from, body)
            case "start": return this.on_start(from, body);
            case "call": return this.on_call(from, body);
            case "spawn": return this.on_spawn(from, body);
            case "destroy": return this.on_destroy(from, body);
            case "regist": return this.on_regist(from, body);        //注册一个名字
            case "unregist": return this.on_unregist(from, body);    //反注册一个名字
            case "resp": return this.on_resp(from, body);   //收到一个响应

            case "post_ant": return this.on_post_ant(from, body);   //要求发给某个ant
            case "broad_ants": return this.on_broad_ants(from, body);        //广播给所有的ant
            case "trigger_ant": return this.on_trigger_ant(from, body);

            default: throw new Error(`unknown message: ${type}`)
        }
    }

    //------------------------------------------
    send(target, type, args, ...transfers)
    {
        if (target.port)
        {
            target.port.postMessage({
                type,
                args
            }, transfers)
        }
        else if (target == this)
        {
            const clone_args = clone(args)

            setImmediate(this.dispatch.bind(this), this, type, clone_args)
        }
        else
        {
            target.postMessage({
                type,
                args
            }, transfers)
        }
    }

    send_all(type, args, include_self = false)
    {
        for (let worker of this.workers.values())
        {
            this.send(worker, type, args)
        }

        if (include_self)
        {
            this.send(this, type, args)
        }
    }

    call(thread, type, args)
    {
        let session = ++this.session

        this.send(thread, "call", { session, type, args })

        return new Promise((resolve, reject) =>
        {
            this.rpcs[session] = {
                resolve: resolve,
                reject: reject
            }
        })
    }

    on_connect(from, { index, port })
    {
        const agent = new WorkerAgent(this)

        agent.connect(index, port)
        agent.port.on('message', (event) =>
        {
            return this.dispatch(agent, event.type, event.args)
        })

        this.workers.set(index, agent)
    }

    async on_check()
    {
        if (this.ants.size > 0)
        {
            return
        }

        let total = 0
        for (const worker of this.workers.values())
        {
            total += await this.call(worker, "size")
        }

        if (total > 0)
        {
            return
        }

        this.send_all("quit", null, true)
    }

    on_size()
    {
        return this.ants.size
    }
    async on_start(from)
    {
        if (this.config.worker == null)
        {
            return
        }

        try
        {
            await this.on_spawn(this, this.config.worker)
        }
        catch (error)
        {
            if (this.config.debug)
            {
                console.error(`spawn worker error:`, error)
            }
        }
    }

    on_quit()
    {
        setTimeout(process.exit, 1000, 0)
    }

    on_resp(from, { session, error, result })
    {
        const rpc = this.rpcs[session]

        delete this.rpcs[session]

        if (error)
        {
            rpc.reject(error)
        }
        else
        {
            rpc.resolve(result)
        }
    }

    async on_call(from, { session, type, args })
    {
        try
        {
            let result = await this.dispatch(from, type, args)

            this.send(from, "resp", { session, result })
        }
        catch (error)
        {
            this.send(from, "resp", { session, error })
        }
    }

    /**
     * 创建一个spawn
     * 
     * @param {Object} args
     */
    async on_spawn(from, { template, inputs, options })
    {
        let id = options.id || ++this.id_helper

        const ant = new Ant(id, this)
        const comp = await this.loader.create(template, ant, inputs, options)

        ant.root = comp
        ant.template = template
        ant.inputs = inputs
        ant.thread = this.index

        setImmediate(async () =>
        {
            await ant.start()
            await ant.after_start()
        })

        this.ants.set(ant.id, ant)

        return ant.id
    }

    async spawn(template, inputs, options = {})
    {
        let index = null

        if (options.index)
        {
            index = options.index
        }
        else if (options.id)
        {
            index = options.id >> 24
        }
        else
        {
            index = options.thread || Math.floor(Math.random() * this.config.threads)
        }

        if (index != this.index)
        {
            const from = this.workers.get(index)

            return this.call(from, "spawn", { template, inputs, options })
        }

        return this.call(this, "spawn", { template, inputs, options })
    }

    destroy(target)
    {
        const index = target >> 24

        if (index == this.index)
        {
            return this.send(this, "destroy", { id: target })
        }

        const from = this.workers.get(index)

        return this.send(from, "destroy", { id: target })
    }

    async on_destroy(from, args)
    {
        let { id } = args

        let ant = this.ants.get(id)

        if (ant == null)
        {
            if (this.config.debug)
            {
                console.warn("no such ant", id)
            }
            return
        }

        this.ants.delete(id)

        if (ant.name)
        {
            this.unregist(ant.name)
        }

        if (this.ants.size == 0)
        {
            this.send(this, "check")
        }

        ant.stop()
    }

    regist(name, id)
    {
        let exists = this.names[name]
        if (exists)
        {
            console.error("name exists", name, id, exists)
        }

        this.names[name] = id

        if (name.startsWith("@") == false)      //gloabl regist
        {
            this.send_all("regist", { name, id })
        }
    }

    /**
     * 通过名字注册
     * @param {} worker 
     * @param {*} args 
     */
    on_regist(worker, { name, id })
    {
        this.names[name] = id
    }

    unregist(name)
    {
        delete this.names[name]

        if (this.names.startsWith("@") == false)
        {
            this.send_all("unregist", { name })
        }
    }

    /**
     * 反注册名字
     * @param {*} worker 
     * @param {*} args 
     */
    on_unregist(worker, { name })
    {
        delete this.names[name]
    }

    search(name)
    {
        return this.names[name]
    }
    /**
     * 
     * @param {*} worker 
     * @param {*} param1 
     * @returns 
     */
    on_post_ant(worker, { from, target, type, args, context })
    {
        let ant = this.ants.get(target)

        if (typeof target == "string")
        {
            ant = this.ants.get(this.names[target])
        }

        if (ant)
        {
            context.from = from

            return ant.dispatch(type, args, context)
        }
        else
        {
            throw new Error("ant not found:" + target + ":" + type)
        }
    }

    post_ant(from, target, type, args, context = {})
    {
        const index = target >> 24

        if (index == this.index)
        {
            return this.send(this, "post_ant", { from, target, type, args, context })
        }

        const thread = this.workers.get(index)

        return this.send(thread, "post_ant", { from, target, type, args, context })
    }

    call_ant(from, target, type, args, context = {})
    {
        const index = target >> 24

        if (index == this.index)
        {
            return this.call(this, "post_ant", { from, target, type, args, context })
        }

        const thread = this.workers.get(index)

        return this.call(thread, "post_ant", { from, target, type, args, context })
    }

    on_broad_ants(from, { template, type, args, context })
    {
        for (const { key, val } of this.ants.entries()) 
        {
            if (val.template != template)
            {
                continue
            }

            try
            {
                this.post_ant(0, key, type, args, context)
            }
            catch (error)
            {
                console.error(error)
            }
        }
    }

    broad_ants(template, type, args, context = {})
    {
        this.send_all("broad_ants", { template, type, args, context }, true)
    }


}

/**
 * 开辟一个线程的代理，由他去发去到真正的线程操作
 */
export class WorkerAgent
{
    constructor(app)
    {
        this.app = app
        this.config = app.config
    }

    connect(index, port)
    {
        this.index = index
        this.port = port
    }
}