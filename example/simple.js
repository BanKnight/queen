module.exports = function (ant)
{
    const arg = ant.args[0]

    ant.on("start", () =>
    {
        ant.console.log("ant entry", ant.template, ant.args, ant.worker)

        ant.destroy()

        if (arg != "child")
        {
            ant.spawn(ant.template, ["child"], ant.options)
        }
    })

    ant.once("exit", () =>
    {
        ant.console.log("on exit", ant.template, ant.args)
    })
}