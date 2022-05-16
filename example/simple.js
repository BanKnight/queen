module.exports = function (ant)
{
    ant.on("start", () =>
    {
        console.log("ant entry", ant.id, ant.template, ant.args)
    })
}