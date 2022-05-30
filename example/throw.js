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

async function on_main_entry(ant)
{
    let test = await ant.spawn(ant.template, ["child"])

    await ant.caller.throw(test)
}

function on_child_entry(ant)
{
    ant.methods.throw = () =>
    {
        throw new Error("test")
    }
}