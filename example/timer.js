export default {
    data()
    {
        return {
            count: 0
        }
    },
    hooks: {
        start()
        {
            this.$ant.setTimeout(() =>
            {
                console.log("timeout timer")
                this.$ant.destroy()

            }, 5000,)
        },
    },
    timers: {
        "1s": {
            interval: 1000,
            handler()
            {
                console.log("1s", ++this.count)
            }
        }
    }
}