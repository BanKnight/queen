
//node .\lib\bin.js config.js
const assert = require('assert');

module.exports = async function (ant)
{
    let arg = ant.$args[0]

    init(ant)

    ant.once("start", async function ()
    {
        console.log("ant entry", ant.id, ant.$template, arg)

        if (arg == "child")
        {
            ant.handlers.add = (...args) =>
            {
                return args.reduce((prev, current) =>
                {
                    return prev + current
                })
            }

            ant.handlers.echo = (value) =>
            {
                return value
            }

            ant.handlers.random = (min, max) =>
            {
                return Math.floor(Math.random() * (max - min) + min)
            }

            ant.handlers.next = async (others, values, prev, index) =>
            {
                prev += values[index++]

                let next = others[index]

                if (next)
                {
                    return await ant.call(next, "next", others, values, prev, index)
                }
                else
                {
                    return prev
                }
            }

            ant.handlers.throw = () =>
            {
                throw new Error("error")
            }
        }
        else
        {
            let others = []
            let values = []

            for (let i = 0; i < 2; i++)
            {
                let test = await ant.spawn("boot", ["child"])
                let value = await ant.call(test, "random", 1, 10000)

                others.push(test)
                values.push(value)
            }

            const first = others[0]

            //1对多调用
            let result = await ant.call(first, "add", ...values)
            //链式调用
            let result2 = await ant.call(first, "next", others, values, 0, 0)

            let answer = values.reduce((prev, curr) => { return prev + curr }, 0)

            assert.equal(result, answer)
            assert.equal(result2, answer)

            let complex = {
                float: 10.555,
                int: 1000,
                string: "hello world",
                bool: true,
                array: [1, 2, 3, 4, 5],
                object: {
                    a: 1,
                    b: 2,
                    c: 3,
                    d: 4,
                }
            }
            complex.self = complex

            for (let i = 0; i < 100; i++)
            {
                let index = Math.floor(Math.random() % others.length)
                let curr = others[index]

                let agent = ant.make_agent(curr)

                let value = await agent.caller.echo(complex)

                assert.deepStrictEqual(value, complex)
            }


            {
                const check_name = await ant.spawn("boot", ["child"], { name: "world" })

                let value = await ant.call(check_name, "echo", "hello")

                console.log("spawn world", check_name)

                assert.equal(value, "hello")
            }

            {
                let id = ant.search("world")

                console.log("search world and then destroy", id)

                ant.destroy(id)
            }

            console.log("test passed")

            // await ant.call(first, "throw")
        }
    })

    ant.on("exit", function ()
    {
        console.log("ant exit", ant.id, ant.$template)
    })
}

function init(ant)
{
    ant.session = 0
    ant.rpcs = {}
    ant.handlers = {}       //这里建议存放function而不是lamda，有利于传递this
    // ant.$broad = new BroadcastChannel("ant")        //广播通道，参考 http://nodejs.cn/api/worker_threads.html#class-broadcastchannel-extends-eventtarget

    ant.on("call", async function (from, session, name, ...args)
    {
        let handler = ant.handlers[name]

        ant.last = from

        try
        {
            let result = await handler.apply(ant, args)

            ant.response(from, session, result)
        }
        catch (error)
        {
            ant.response(from, session, null, error)
        }
    })

    ant.on("send", function (from, name, ...args)
    {
        ant.last = from

        let handler = ant.handlers[name]

        handler.apply(ant, args)
    })

    ant.on("response", function (from, session, result, error)
    {
        const rpc = ant.rpcs[session]

        delete ant.rpcs[session]

        if (error)
        {
            rpc.reject(error)
        }
        else
        {
            rpc.resolve(result)
        }
    })

    ant.send = (target, name, ...args) =>
    {
        ant.post(target, "send", name, ...args)
    }

    ant.call = (target, name, ...args) =>
    {
        let id = ++ant.session

        return new Promise(function (resolve, reject)
        {
            ant.rpcs[id] = {
                session: id,
                resolve: resolve,
                reject: reject
            }

            ant.post(target, "call", id, name, ...args)
        })
    }

    ant.response = (target, session, result, error) =>
    {
        ant.post(target, "response", session, result, error)
    }

    ant.make_agent = (id) =>
    {
        let agent = {
            methods: {},
        }

        agent.sender = new Proxy(agent, {
            has: function () { return true; },
            get: function (target, name)
            {
                let exists = target.methods[name]
                if (exists == null)
                {
                    exists = target.methods[name] = (...args) =>
                    {
                        return ant.send(id, name, ...args)
                    }
                }

                return exists
            }
        })

        agent.caller = new Proxy(agent, {
            has: function () { return true; },
            get: function (target, name)
            {
                let exists = target.methods[name]
                if (exists == null)
                {
                    exists = target.methods[name] = (...args) =>
                    {
                        return ant.call(id, name, ...args)
                    }
                }

                return exists
            }
        })

        return agent
    }
}