export default {
    hooks: {
        start()
        {
            console.log("ant.start", this.$ant.template)

            this.$ant.setTimeout(console.log, 5000, "timeout timer")

            this.$ant.destroy()
        },
        stop()
        {
            console.log("ant.stop", this.$ant.template)
        }
    },
}