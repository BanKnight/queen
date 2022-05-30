//queen-core --config config.agent

module.exports = function (ant)
{
    ant.on("start", () =>
    {
        ant.console.log("this is worker")

        ant.methods.hello = () =>
        {
            return "world"
        }
    })
}