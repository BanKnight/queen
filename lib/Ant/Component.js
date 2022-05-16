
const { EventEmitter } = require('events');
const path = require('path');

const noop = () => { }

module.exports = function (Parent)
{
    return class Ant extends Parent
    {
        constructor(context)
        {
            super(context)

            this.children = []
        }

        async add_comp(define_file, args = {}, options = {})
        {
            let define = define_file
            let file = define_file.$file

            if (typeof define_file == "string")
            {
                if (define_file.startsWith("."))
                {
                    file = require.resolve(path.resolve(define_file))
                }
                else
                {
                    file = define_file
                }

                define = require(file)
            }

            define.on = define.on || {}
            define.data = define.data || noop
            define.methods = define.methods || {}
            define.$file = file

            args.on = args.on || {}

            const child = new Comp(this)

            this.patch_comp(child, define)

            if (define.data)
            {
                define.data.apply(child)
            }

            for (const key in args.on)
            {
                child.on(key, args.on[key])
            }

            for (const key in define.props)
            {
                const val = define.props[key]
                const override = args[key]

                if (override)
                {
                    child[key] = override
                }
                else
                {
                    child[key] = get_val(val)
                }
            }

            child.name = options.name || child.name || "default"

            this.children.push(child)

            Object.defineProperty(this.children, child.name, {
                value: child,
                enumerable: false,
            })

            if (child.start)
            {
                await child.start()
            }

            this.emit("add_comp", child, define)

            return child
        }

        /**
         * 
         * @param {EventEmitter} child 
         * @param {Object} define 
         */
        patch_comp(child, define)
        {
            for (const key in define.on)
            {
                const old = child[key]
                const info = define.on[key]

                const func = info.bind(child)

                child[key] = func
                child.on(key, func)

                if (old)
                {
                    child.off(key, old)
                }
            }

            for (const key in define.timers)
            {
                const info = define.timers[key]
                const old = child.$timers[key]
                const func = info.handler.bind(child)

                this.clearInterval(old)      //clear old timer

                child[key] = func
                child.$timers[key] = this.setInterval(func, info.interval || 1000)
            }

            for (const key in define.methods)
            {
                const val = define.methods[key].bind(child)

                child[key] = val

                this.add_method(key, val)
            }

            for (const key in define)
            {
                if (key == "data" || key == "on" ||
                    key == "methods" || key == "props")
                {
                    continue
                }

                let val = define[key]

                if (typeof val == "function")
                {
                    child[key] = val.bind(child)
                }
                else
                {
                    child[key] = val
                }
            }
        }
    }
}

class Comp extends EventEmitter
{
    constructor(ant)
    {
        super()
        this.ant = ant
        this.$timers = {}
    }
    get sender()
    {
        return this.ant.sender
    }

    get caller()
    {
        return this.ant.caller
    }

    get last()
    {
        return this.ant.last
    }

    get config()
    {
        return this.ant.config
    }

    spawn(...args)
    {
        return this.ant.spawn(...args)
    }

    add_comp(define, args)
    {
        return this.ant.add_comp(define, args)
    }
    get_comp(name)
    {
        return this.ant.children[name]
    }
}

function get_val(info)
{
    let func = info.default || info

    if (typeof func == "function")
    {
        return func()
    }

    return info
}

