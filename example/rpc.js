
//node .\lib\bin.js config.js
const assert = require('assert');

module.exports = async function (ant)
{
    const arg = ant.args[0]

    ant.once("start", async function ()
    {
        ant.console.log("ant entry", ant.id, ant.template, arg)

        if (arg == "child")
        {
            await on_child_entry(ant)
        }
        else
        {
            await on_main_entry(ant)
        }

        ant.console.log("done")
    })

    ant.once("exit", function ()
    {
        ant.console.log("exit", ant.template)
    })
}

function on_child_entry(ant)
{
    ant.methods.random = ({ min, max }) =>
    {
        return Math.floor(Math.random() * (max - min) + min)
    }

    ant.methods.add = ({ args }) =>
    {
        return args.reduce((prev, current) =>
        {
            return prev + current
        })
    }

    ant.methods.echo = (value) =>
    {
        return value
    }

    ant.methods.next = async ({ others, values, prev, index }) =>
    {
        prev += values[index++]

        let next = others[index]

        if (next)
        {
            return await ant.caller.next(next, { others, values, prev, index })
        }
        else
        {
            return prev
        }
    }

    ant.methods.throw = () =>
    {
        throw new Error("error")
    }
}

async function on_main_entry(ant)
{
    let others = []
    let values = []

    for (let i = 0; i < 100; i++)
    {
        let test = await ant.spawn(ant.template, ["child"])

        let value = await ant.caller.random(test, {
            min: 1,
            max: 10000
        })

        others.push(test)
        values.push(value)
    }

    const first = others[0]

    let result1 = await ant.caller.add(first, { args: values })
    let result2 = await ant.caller.next(first, { others, values, prev: 0, index: 0 })

    let answer = values.reduce((prev, curr) => { return prev + curr }, 0)

    assert.equal(result1, answer)
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

        let value = await ant.caller.echo(curr, complex)

        assert.deepStrictEqual(value, complex)
    }

    {
        const check_name = await ant.spawn(ant.template, ["child"], { name: "world" })

        let value = await ant.caller.echo(check_name, "hello")

        assert.equal(value, "hello")
    }

    {
        let id = ant.search("world")

        ant.console.log("search world and then destroy", id)

        assert.ok(id != null, "world not found")

        ant.destroy(id)
    }

    for (const one of others)
    {
        ant.destroy(one)
    }

    ant.destroy()
}