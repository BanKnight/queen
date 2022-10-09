
import { EventEmitter } from 'events';

export class Ant extends EventEmitter
{
    constructor(id, app)
    {
        super()

        this.id = id
        this.app = app
        this.root = null

        this.working = true
        this.timers = []

        this.methods = {}

        this.main = { msgs: [], lock: null }
        this.standby = { msgs: [], lock: null }
    }

    async start()
    {
        if (this.root)
        {
            await this.root.start()
        }
    }

    async after_start()
    {
        if (this.root)
        {
            await this.root.after_start()
        }
    }

    async stop()
    {
        if (this.root)
        {
            await this.root.stop()
        }

        for (const timer of this.timers)
        {
            timer.clear()
        }

        this.timers = {}
    }

    dispatch(type, body, context)
    {
        switch (type)
        {
            case "handle":
                return this.on_handle(body.name, body.args, context)
            case "emit":
                return this.emit(body.name, body.args)
            case "do":
                return body.do(...body.args)
            case "call":
                return this.on_call(body.session, body.name, body.args, context)
            default:
                break
        }
    }

    send(target, name, ...args)
    {
        return this.app.post_ant(this.id, target, "handle", { name, args })
    }

    call(target, name, ...args)
    {
        return this.app.call_ant(this.id, target, "handle", { name, args })
    }

    spawn(template, ...args)
    {
        return this.app.spawn(template, ...args)
    }

    on_handle(name, args, context)
    {
        let method = this.methods[name]
        if (method == null)
        {
            return
        }
        return method(...args, context)
    }

    async on_call(session, name, args, context)
    {
        try
        {
            const result = await this.on_handle(name, args, context)

            this.app.response(session, null, result)
        }
        catch (e)
        {
            this.app.response(session, e)
        }
    }

    // async wait(which)
    // {
    //     return new Promise((resolve, reject) =>
    //     {
    //         which.lock = { resolve, reject }
    //     })
    // }

    // async wake(which, error, result)
    // {
    //     let lock = which.lock
    //     if (lock == null)
    //     {
    //         return
    //     }

    //     delete which.lock

    //     if (error)
    //     {
    //         lock.reject(error)
    //     }
    //     else
    //     {
    //         lock.resolve(result)
    //     }
    // }

    // push(msg)
    // {
    //     this.main.msgs.push(msg)

    //     this.wake(this.main)
    // }

    fork(cb, ...args)
    {
        setImmediate(() =>
        {
            this.dispatch("do", { do: cb, args })
        })
    }

    setInterval(callback, interval, ...args)
    {
        const timer = setInterval(() =>
        {
            this.dispatch("do", { do: callback, args })

        }, interval, ...args)

        this.timers.push(timer)

        return timer
    }

    setTimeout(callback, delay, ...args)
    {
        const timer = setTimeout(() =>
        {
            this.dispatch("do", { do: callback, args })

            this.timers.splice(this.timers.indexOf(timer), 1)

        }, delay, ...args)

        timer.clear = () =>
        {
            clearTimeout(timer)
        }

        this.timers.push(timer)

        return timer
    }

    clearInterval(id)
    {
        clearInterval(id)

        let index = this.timers.indexOf(id)
        this.timers.splice(index, 1)
    }

    clearTimeout(id)
    {
        clearTimeout(id)

        let index = this.timers.indexOf(id)
        this.timers.splice(index, 1)
    }

    destroy(target)
    {
        target = target || this.id

        this.app.destroy(target)
    }
}
