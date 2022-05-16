
const { EventEmitter } = require('events');
/**
 * ant.send 和 ant.call 由外界注入
 */
module.exports = class Ant extends EventEmitter
{
    constructor(context)
    {
        super(context.options.event)

        this.mode = context.options.mode || "sync"         //sync,async
        this.id = context.id
        this.name = context.name
        this.template = context.template
        this.args = context.args
        this.worker = context.worker            //所在的worker的index
        this.config = context.config
        this.options = context.options

        this.methods = {}
        this.timers = new Map()

        this.__sender = {}
        this.__caller = {}

        const that = this

        this.sender = new Proxy(this.__sender, {
            has: function () { return true; },
            get: function (target, name)
            {
                let exists = target[name]
                if (exists == null)
                {
                    exists = target[name] = (id, ...args) =>
                    {
                        return that.send(id, name, ...args)
                    }
                }
                return exists
            }
        })

        this.caller = new Proxy(this.__caller, {
            has: function () { return true; },
            get: function (target, name)
            {
                let exists = target[name]
                if (exists == null)
                {
                    exists = target[name] = (id, ...args) =>
                    {
                        return that.call(id, name, ...args)
                    }
                }

                return exists
            }
        })
    }

    add(name, method)
    {
        this.methods[name] = method
    }

    async handle(name, arg, context)
    {
        let method = this.methods[name]

        if (method == null)
        {
            throw new Error("no such method:" + name)

        }
        try
        {
            this._lock()
            let result = await method.call(this, arg, context)
            return result
        }
        catch (e)
        {
            this.unlock()
            this.emit("error", e)
        }
    }

    _lock()
    {
        if (this.mode == "async")
        {
            return
        }

        if (this.mutex == null)
        {
            this.mutex = []         //
        }
        else
        {
            return new Promise(resolve =>
            {
                this.mutex.push(resolve)
            })
        }
    }

    unlock()
    {
        if (this.mode == "async")
        {
            return
        }

        let resolve = this.mutex.shift()
        if (resolve)
        {
            resolve()
        }
        else
        {
            this.mutex = null
        }
    }

    on_timer(id)
    {
        let timer = this.timers.get(id)
        if (timer == null)
        {
            return
        }

        let { callback, args, repeat } = timer

        if (!repeat)
        {
            this.timers.delete(id)
        }

        return callback(...args)
    }
    setImmediate(callback, ...args)
    {
        let timer = {
            id: this.next_session(),
            callback,
            args,
            repeat: false
        }

        timer.real = setImmediate(() =>
        {
            this.trigger(this.id, "on_timer", timer.id)
        })

        this.timers.set(timer.id, timer)

        return timer.id
    }

    clearImmediate(id)
    {
        this.timers.delete(id)
        return clearImmediate(id)
    }
}