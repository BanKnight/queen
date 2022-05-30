module.exports = function (ant)
{
    ant.on("start", async () =>
    {
        const agent = ant.search("@worker")

        ant.console.log("this is boot,my worker is ", agent)

        const resp = await ant.caller.hello(agent)

        ant.console.log("resp from worker", resp)

        ant.destroy()

        ant.quit()
    })
}