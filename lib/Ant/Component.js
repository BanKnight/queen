
const { EventEmitter } = require('events');
const path = require('path');

const noop = () => { }
const composed = ["hooks", "on"]                    //合并的
const replaced = ["timers", "methods", "props"]     //替换的
const names = [].concat(composed, replaced)

module.exports = function (Parent)
{
    return class Ant extends Parent
    {
        constructor(context)
        {
            super(context)

            this.children = []
        }

        async destructor()
        {
            for (const child of this.children)
            {
                await child.exit()
            }

            await super.destructor()
        }

        async add_comp(define_file, args = {}, options = {})
        {
            const child = new Comp(this)

            const define = require_define(define_file)
            const new_define = mixin(define)

            this.patch_comp(child, new_define)

            if (new_define.data)
            {
                new_define.data.apply(child)
            }

            for (const key in args.on)
            {
                child.on(key, args.on[key])
            }

            for (const key in new_define.props)
            {
                const val = new_define.props[key]
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

            this.emit("add_comp", child, new_define)

            return child
        }

        hotfix_comp(child, define_file)
        {
            const define = require_define(define_file)

            const new_define = mixin(define)

            this.patch_comp(child, new_define)
        }

        /**
         * 
         * @param {EventEmitter} child 
         * @param {Object} define 
         */
        patch_comp(child, define)
        {
            //处理自身的生命周期
            for (const key in define.hooks)
            {
                const info = define.hooks[key]
                const func = info.bind(child)

                child[key] = func
            }

            //对ant的事件处理
            for (const key in define.on)
            {
                const old = child[key]
                const info = define.on[key]
                const func = info.bind(child)

                child[key] = func

                this.off(key, old)
                this.on(key, func)
            }

            //对外提供的timer
            for (const key in define.timers)
            {
                const info = define.timers[key]
                const old = child.$timers[key]
                const func = info.handler.bind(child)

                this.clearInterval(old)      //clear old timer

                child[key] = func
                child.$timers[key] = this.setInterval(func, info.interval || 1000)
            }

            //对外界的rpc回调处理
            for (const key in define.methods)
            {
                const val = define.methods[key].bind(child)

                child[key] = val
                child.methods[key] = val

                this.add_method(key, val)
            }

            //其余统统挂载到child上
            for (const key in define)
            {
                if (key == "data" || key == "on" || key == "hooks" ||
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

function require_define(whole_path)
{
    let define = whole_path

    if (typeof whole_path == "string")
    {
        if (whole_path.startsWith("."))
        {
            whole_path = require.resolve(path.resolve(define_file))
        }

        define = require(whole_path)

        define.$path = whole_path
    }

    if (define.mixins)
    {
        for (let i = 0; i < define.mixins.length; ++i)
        {
            const one = define.mixins[i]

            define.mixins[i] = require_define(one)
        }

    }

    return define
}

function mixin(define)
{
    const context = {}
    const new_define = {}

    for (const name of names)
    {
        context[name] = {}
        new_define[name] = {}
    }

    context.data = []

    collect(define, context)

    for (const name of composed)
    {
        const group = context[name]     //hooks timers methods 
        const new_group = new_define[name]

        for (const key in group)
        {
            const array = group[key]

            const func = async function ()      //合并
            {
                for (const info of array)
                {
                    await info.apply(this, arguments)
                }
            }

            new_group[key] = func
        }
    }

    for (const name of replaced)
    {
        const group = context[name]     //hooks timers methods 
        const new_group = new_define[name]

        for (const key in group)
        {
            const array = group[key]

            const func = array[array.length - 1]        //替换

            new_group[key] = func
        }
    }

    new_define.data = async function ()
    {
        for (const info of context.data)
        {
            await info.apply(this, arguments)
        }
    }

    return new_define
}

function collect(target, context)
{
    for (const one of target.mixins || [])
    {
        collect(one, context)
    }

    for (const name of names)
    {
        const group = context[name]
        const group_exits = target[name]

        if (group_exits == null)
        {
            continue
        }
        for (const key in group_exits)
        {
            const val = group_exits[key]

            let exists = group[key]
            if (exists == null)
            {
                exists = group[key] = []
            }

            exists.push(val)
        }
    }

    if (target.data)
    {
        context.data.push(target.data)
    }

}

class Comp extends EventEmitter
{
    constructor(ant)
    {
        super()
        this.ant = ant
        this.methods = {}
        this.$timers = {}
    }

    start()
    {

    }

    exit()
    {

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

    get console()
    {
        return this.ant.console
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




