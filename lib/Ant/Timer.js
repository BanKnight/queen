/**
 * 
 * @param {*} Parent 
 * @returns 
 */
module.exports = function (Parent)
{
    return class Ant extends Parent
    {
        constructor(context)
        {
            super(context)

            this.timers = {}
        }

        async destructor()
        {
            Object.values(this.timers).forEach(timer => timer.cancle())

            await super.destructor()
        }

        on_timer(id)
        {
            let timer = this.timers[id]
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

            this.timers[id] = timer

            return id
        }

        clearImmediate(id)
        {
            let timer = this.timers[id]
            if (timer == null)
            {
                return
            }
            delete this.timers[id]
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

            this.timers[id] = timer

            return id
        }

        clearTimemout(id)
        {
            let timer = this.timers[id]
            if (timer == null)
            {
                return
            }
            delete this.timers[id]
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

            this.timers[id] = timer

            return id
        }

        clearInterval(id)
        {
            let timer = this.timers[id]
            if (timer == null)
            {
                return
            }
            delete this.timers[id]
            clearInterval(timer.real)
        }
    }
}

