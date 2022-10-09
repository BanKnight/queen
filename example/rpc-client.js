export default {
    hooks:{
        async start()
        {
            console.log("ant.start",this.$ant.template)

            this.server = await this.$ant.spawn("rpc-server", {
                props: {
                    name: "server"
                }
            })

            const back = await this.$ant.call(this.server, "echo", "hello")

            console.log("get back", back)
        },
        stop()
        {
            console.log("ant.stop",this.$ant.template)
        }
    },
}