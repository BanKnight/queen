module.exports = function (ant)
{
    ant.on("start", () =>
    {
        console.log("ant entry", ant.id, ant.template, ant.args)

        ant.setImmediate(console.log, "aaaaa", "bbbb")

        let id = ant.setInterval(console.log, 1000, "interval 1s", "cccc")

        console.log("setInterval", id)

        ant.setTimeout(ant.clearInterval.bind(ant, id), 5000)

        ant.setTimeout(ant.destroy, 8000)
    })
}