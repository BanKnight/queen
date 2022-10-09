import { Worker, SHARE_ENV } from 'worker_threads';

/**
 * 开辟一个真的线程
 */
export class Thread
{
    constructor(index, app)
    {
        this.app = app
        this.index = index
        this.session = 0
        this.rpcs = {}

        this.worker = new Worker(process.argv[1], {
            workerData: {
                index,
            },
            env: SHARE_ENV,
        })
    }

    send(type, args, ...transfers)
    {
        this.worker.postMessage({
            type,
            args
        }, transfers)
    }

    /**
     * 告诉线程，对方可以通过这个port发送给index
     * @param {*} index 
     * @param {*} port 
     */
    connect(index, port)
    {
        this.send("connect", { index, port }, port)
    }

    async start()
    {
        this.worker.on('message', (event) =>
        {
            // if (config.debug)
            // {
            //     console.log(`queen:recv_message`, i, event)
            // }

            return this.dispatch(event.type, event.args)
        })
    }

    dispatch(type, body)
    {
        switch (type)
        {
            case "call": return this.on_call(body);;
            case "response": return this.on_response(body);
            default: throw new Error(`unknown message: ${type}`)
        }
    }


    /**
     * 发送给ant
     * @param {*} id 
     * @param {*} args 
     * @returns 
     */
    post(id, args)
    {
        return this.send("post", { id, args })
    }



    //====================================================================================================================

    on_response(args)
    {
        const id = args.session
        const rpc = this.rpcs[id]

        delete this.rpcs[id]

        if (args.error)
        {
            rpc.reject(args.error)
        }
        else
        {
            rpc.resolve(args.result)
        }
    }

    send_local_ant(id, msg)
    {
        const ant = this.ants.get(id)

        if (ant)
        {
            ant.push(msg)
        }
        else
        {
            throw new Error(`ant ${id} not found`)
        }
    }

    send_remote_ant(id, msg)
    {
        this.app.send_ant(id, msg)
    }

    call_ant(id, msg)
    {
        if (this.is_same_thread(id))
        {
            return this.call_local_ant(id, msg)
        }
        else
        {
            return this.call_remote_ant(id, msg)
        }
    }

    call_local_ant(id, msg)
    {
        const ant = this.ants.get(id)
        const session = ++this.session

        if (ant)
        {
            ant.push({
                ...msg,
                type: "call",
                session: session,
            })
        }
        else
        {
            throw new Error(`ant ${id} not found`)
        }

        return new Promise((resolve, reject) =>
        {
            this.rpcs[session] = { resolve, reject }

            setTimeout(() =>
            {
                const rpc = this.rpcs[session]
                if (rpc)
                {
                    delete this.rpcs[session]

                    rpc.reject(new Error(`call_ant timout:${msg.name}`))
                }

            }, this.config.timeout || 3000)
        })
    }

    call_remote_ant(id, msg)
    {
        return this.app.call_ant(id, msg)
    }
}