module.exports = function (ant)
{
    ant.on("start", () =>
    {
        console.log("ant entry", ant.id, ant.template, ant.args)

        ant.setImmediate(console.log, "aaaaa", "bbbb")

        let id = ant.setInterval(console.log, 3000, "interval 3s", "cccc")

        console.log("setInterval", id)

        ant.setTimeout(ant.clearInterval.bind(ant, id), 10000)

    })
}