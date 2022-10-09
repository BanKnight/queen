import { serialize, deserialize } from "v8"
import { MessageChannel } from 'worker_threads';
import { Thread } from './Thread.js';
import { Loader } from "./Loader.js"

import defaultConfig from "./config.default.js"

export class Application
{
    constructor(config)
    {
        this.config = Object.assign({}, defaultConfig, config)
        this.loader = new Loader(this, this.config)

        this.threads = []
        this.envs = {}

        this.session = 0
        this.rpcs = {}
    }

    async start()
    {
        this.config.threads = this.config.threads

        for (let i = 0; i < this.config.threads; i++)
        {
            const thread = new Thread(i, this)

            this.threads.push(thread)

            thread.worker.on('error', (event) =>
            {
                console.log(`queen:on_error(threads[${thread.index}])`)
                console.log(event)
            })

            thread.worker.on('exit', () =>
            {
                console.log(`queen:on_exit(threads[${thread.index}])`)

                this.threads[thread.index] = false

                for (const thread of this.threads)
                {
                    if (thread)
                    {
                        this.send(thread, "check")
                        return
                    }
                }

                console.log("queen:exit@all workers exit")
                setImmediate(process.exit, 0)
            })
        }

        for (let i = 0; i < this.threads.length; i++)
        {
            const first = this.threads[i]

            for (let j = i + 1; j < this.threads.length; j++)
            {
                const second = this.threads[j]

                const channel = new MessageChannel()

                first.connect(j, channel.port1)
                second.connect(i, channel.port2)
            }
        }

        for (const thread of this.threads)
        {
            thread.worker.on('message', (event) =>
            {
                return this.dispatch(thread, event.type, event.args)
            })

            this.send(thread, "start")
        }

        const boot = this.config.boot

        this.spawn(boot.template, boot.inputs, boot.options)
    }

    configure(env, ...args)
    {
        // if (env != "*" && process.env.NODE_ENV != env)
        // {
        //     return
        // }

        // let exists = this.envs[env]
        // if(exists == null)
        // {
        //     exists = this.envs[env] = []
        // }

        // const callback = args.pop()

        // exists.push({
        //     conditions:args,
        //     callback
        // })
    }

    choose(meta = {})
    {
        let index = 0

        if (meta.index)
        {
            index = meta.index
        }
        else if (meta.id)
        {
            index = id >> 24
        }
        else
        {
            index = meta.thread || Math.floor(Math.random() * this.config.threads)
        }
        return this.threads[index]
    }

    dispatch(from, type, body)
    {
        if (this.config.debug)
        {
            console.log(`Application:dispatch`, type)
        }
        switch (type)
        {
            case "call": return this.on_call(from, body);;
            case "resp": return this.on_response(from, body);
            default: throw new Error(`unknown message: ${type}`)
        }
    }

    async on_call(from, { id, name, args })
    {
        try
        {
            let result = await this.dispatch(from, name, args)

            this.response(id, result)
        }
        catch (error)
        {
            this.response(id, null, error)
        }
    }

    on_response(from, { session, result, error })
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

    spawn(template, inputs, options = {})
    {
        let thread = this.choose(options)

        inputs = deserialize(serialize(inputs))
        options = deserialize(serialize(options))

        return this.call(thread, "spawn", { template, inputs, options })
    }

    send(thread, type, args, ...transfers)
    {
        thread.worker.postMessage({
            type,
            args
        }, transfers)
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

}
