import { EventEmitter } from 'events';

export class Component extends EventEmitter
{
    constructor(ant)
    {
        super()

        this.$ant = ant
        this.$app = ant.app
        this.$options = null
        this.$refs = {}
        this.$timers = {}

        this.$children = []
    }

    patch_basic(inputs)
    {
        const options = this.$options

        for (const key in inputs.props)
        {
            this[key] = inputs.props[key]
        }
        for (const key in inputs.on)
        {
            const callback = inputs.on[key]

            this.on(key, callback)
        }

        for (const key in options.props)
        {
            const prop = options.props[key]

            if (inputs.props.hasOwnProperty(key))
            {
                continue
            }
            else if (prop.hasOwnProperty("default"))
            {
                this[key] = prop.default
            }
            else if (typeof prop == "function")
            {
                this[key] = prop.call(this)
            }
            else
            {
                this[key] = prop
            }
        }

        for (const one of options.data)
        {
            const obj = one.call(this)

            Object.assign(this, obj)
        }
    }

    patch_locals()
    {
        for (const key in this.$options.locals)
        {
            this[key] = this.$options.locals[key]
        }
    }

    repatch(options)
    {
        if (this.$options)
        {
            this.unpatch_remotes()
            this.unpatch_timers()
            this.unpatch_events()
        }

        this.$options = options

        this.patch_events()
        this.patch_timers()
        this.patch_remotes()
    }

    async start()
    {
        await this.start_self()
        await this.start_children()
    }

    async after_start()
    {
        const after_start = this.$options.hooks.after_start
        if (after_start == null)
        {
            this.patch_events()
            this.patch_timers()
            this.patch_remotes()

            return
        }
        for (const one of after_start)
        {
            await one.call(this)
        }

        this.patch_events()
        this.patch_timers()
        this.patch_remotes()
    }
    async stop()
    {
        this.unpatch_remotes()
        this.unpatch_timers()
        this.unpatch_events()

        await this.stop_children()
        await this.stop_self()
    }
    async start_self()
    {
        const starts = this.$options.hooks.start
        if (starts == null)
        {
            return
        }
        for (const one of starts)
        {
            await one.call(this)
        }
    }



    async stop_self()
    {
        const stops = this.$options.hooks.stop
        if (stops == null)
        {
            return
        }
        for (const one of stops)
        {
            await one.call(this)
        }
    }
    async start_children()
    {
        for (let child of this.$children)
        {
            await child.start()
        }

        for (let child of this.$children)
        {
            await child.after_start()
        }
    }
    async stop_children()
    {
        for (let child of this.$children)
        {
            await child.stop()
        }
    }

    patch_events()
    {
        for (const key in this.$options.events)
        {
            const events = this.$options.events[key]

            this.patch_event(key, events)
        }
    }

    patch_event(name, events)
    {
        const func = async (...args) =>
        {
            for (const event of events)
            {
                event.call(this, ...args)
            }
        }

        this.$ant.on(name, func)
    }

    unpatch_events()
    {
        for (const key in this.$options.events)
        {
            this.$ant.removeAllListeners(key)
        }
    }

    patch_remotes()
    {
        for (const key in this.$options.remotes)
        {
            const remote = this.$options.remotes[key]

            this.patch_remote(key, remote)
        }
    }

    patch_remote(name, remote)
    {
        this.$ant.methods[name] = (...args) =>
        {
            return remote.call(this, ...args)
        }
    }

    unpatch_remotes()
    {
        for (const key in this.$options.remotes)
        {
            delete this.$ant.methods[key]
        }
    }

    patch_timers()
    {
        for (let name in this.$options.timers)
        {
            const timer = this.$options.timers[name]
            this.patch_timer(name, timer)
        }
    }
    patch_timer(name, timer)
    {
        this.$timers[name] = this.$ant.setInterval(() =>
        {
            timer.handler.call(this)
        }, timer.interval)
    }

    unpatch_timers()
    {
        for (let name in this.$timers)
        {
            const timer = this.$timers[name]

            this.$ant.clearInterval(timer)
        }

        this.$timers = {}
    }
}
