module.exports = function (ant)
{
    ant.on("start", () =>
    {
        ant.console.log("ant log", ant.template, ant.args, ant.worker)
        ant.console.info("ant info", ant.template, ant.args, ant.worker)
        ant.console.warn("ant warn", ant.template, ant.args, ant.worker)
        ant.console.error("ant error", ant.template, ant.args, ant.worker)

        ant.console.table([
            { name: "a" },
            { name: "b" }
        ])

        ant.console.time("time")

        ant.console.log("ant log 1")
        ant.console.log("ant log 2")
        ant.console.log("ant log 3")
        ant.console.log("ant log 4")
        ant.console.log("ant log 5")

        ant.console.timeEnd("time")

        ant.destroy()
    })

    ant.once("exit", () =>
    {
        ant.console.log("on exit", ant.template, ant.args)
    })
}