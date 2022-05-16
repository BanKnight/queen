
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
            timer.cancle()
        }

        return callback(...args)
    }
    setImmediate(callback, ...args)
    {
        let id = this.next_session()
        let timer = {
            id: id,
            callback,
            args,
            repeat: false,
            cancle: this.clearImmediate.bind(this, id),
        }

        timer.real = setImmediate(this.trigger, this.id, "on_timer", id)

        this.timers.set(id, timer)

        return id
    }

    clearImmediate(id)
    {
        let timer = this.timers.get(id)
        if (timer == null)
        {
            return
        }
        this.timers.delete(id)
        clearImmediate(timer.real)
    }

    setTimeout(callback, timeout, ...args)
    {
        let id = this.next_session()
        let timer = {
            id: id,
            callback,
            args,
            repeat: false,
            cancle: this.clearTimemout.bind(this, id),
        }

        timer.real = setTimeout(this.trigger, timeout, this.id, "on_timer", id)

        this.timers.set(id, timer)

        return id
    }

    clearTimemout(id)
    {
        let timer = this.timers.get(id)
        if (timer == null)
        {
            return
        }
        this.timers.delete(id)
        clearTimeout(timer.real)
    }

    setInterval(callback, interval, ...args)
    {
        let id = this.next_session()
        let timer = {
            id: id,
            callback,
            args,
            repeat: true,
            cancle: this.clearInterval.bind(this, id),
        }

        timer.real = setInterval(this.trigger, interval, this.id, "on_timer", id)

        this.timers.set(id, timer)

        return id
    }

    clearInterval(id)
    {
        let timer = this.timers.get(id)
        if (timer == null)
        {
            return
        }
        this.timers.delete(id)
        clearInterval(timer.real)
    }
}