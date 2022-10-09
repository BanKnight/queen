import assert from 'assert';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

import { Component } from './Component.js';

export class Loader
{
    constructor(thread, config)
    {
        this.thread = thread
        this.config = config

        this.regists = {}
        this.caches = {}

        this.rules = {}
        this.rules.data = this.rule_data
        this.rules.template = this.rule_template
        this.rules.props = this.rule_props
        this.rules.hooks = this.rule_hooks
        this.rules.events = this.rule_events
        this.rules.timers = this.rule_timers
        this.rules.remotes = this.rule_remotes
        this.rules.locals = this.rule_locals
    }

    async load(name)
    {
        if (this.caches[name])
        {
            return this.caches[name]
        }

        const whole = path.resolve(this.config.search, name) + ".js"

        const class_ = await import(pathToFileURL(whole))

        return this.regist(name, class_.default)
    }

    async regist(name, class_)
    {
        this.regists[name] = class_
        this.caches[name] = await this.compile(class_)

        return this.caches[name]
    }

    compile(class_)
    {
        const define = {
            data: [],
            template: [],
            props: {},
            hooks: {},
            events: {},
            timers: {},
            remotes: {},
            locals: {},
            unknowns: {}
        }

        return this.mixin(define, class_)
    }

    async create(template, ant, inputs = {})
    {
        const options = await this.load(template)

        assert.ok(options, "template not found: " + template)

        const component = new Component(ant)

        component.$options = options

        component.patch_locals()
        component.patch_basic(inputs)

        if (options.template)
        {
            for (const one_template of options.template)
            {
                const children = await one_template.call(component)

                for (const one of children)
                {
                    const comp = await this.create(one.template, ant, one.inputs)

                    if (one.ref)
                    {
                        component.$refs[one.ref] = comp
                    }

                    component.$children.push(comp)
                }
            }
        }

        return component
    }

    async mixin(define, class_)
    {
        if (typeof class_ == 'string')
        {
            await this.load(class_)

            class_ = this.regists[class_]
        }

        if (class_.mixins)
        {
            for (const mixin of class_.mixins)
            {
                await this.mixin(define, mixin)
            }
        }

        this.mixin_else(define, class_)

        return define
    }

    mixin_else(define, config)
    {
        for (const key in config)
        {
            if (key == "mixins")
            {
                continue
            }

            const val = config[key]
            const rule = this.find_rule(key)

            if (rule == null)
            {
                this.unknown_rule(define, key, val)
                continue
            }
            rule(define, val)
        }
    }

    find_rule(key)
    {
        return this.rules[key]
    }

    unknown_rule(define, key, val)
    {
        define.unknowns[key] = val
    }

    rule_data(define, constructor)
    {
        define.data.push(constructor)
    }

    //创建子对象
    rule_template(define, constructor)
    {
        define.template.push(constructor)
    }

    rule_props(define, obj)
    {
        for (const key in obj)
        {
            define.props[key] = obj[key]
        }
    }
    rule_hooks(define, obj)
    {
        for (const key in obj)
        {
            const func = obj[key]
            let array = define.hooks[key]

            if (array == null)
            {
                array = define.hooks[key] = []
            }

            array.push(func)
        }
    }

    rule_events(define, obj)
    {
        for (const key in obj)
        {
            const func = obj[key]
            let array = define.events[key]

            if (array == null)
            {
                array = define.events[key] = []
            }
            array.push(func)
        }
    }

    rule_timers(define, obj)
    {
        for (const key in obj)
        {
            define.timers[key] = obj[key]
        }
    }

    rule_remotes(define, obj)
    {
        for (const key in obj)
        {
            define.remotes[key] = obj[key]
        }
    }
    rule_locals(define, obj)
    {
        for (const key in obj)
        {
            define.locals[key] = obj[key]
        }
    }
}