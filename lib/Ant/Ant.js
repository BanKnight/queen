
/**
 * ant.send 和 ant.call 由外界注入
 */
module.exports = function (Parent)
{

    return class Ant extends Parent
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

        destructor()
        {

        }

        add_method(name, method)
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
                await this._lock()
                let result = await method.call(this, arg, context)
                this.unlock()
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

            if (this.mutex == null)
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
    }
}

