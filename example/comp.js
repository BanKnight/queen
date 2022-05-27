const father = {
    data()
    {
        this.father_count = "father hello"
    },
    hooks: {
        start()
        {

            this.ant.console.log("father start")
        },
        exit()
        {
            this.ant.console.log("father stop")

        }
    },
    timers: {
        father_second: {
            interval: 1000,
            handler()
            {
                this.ant.console.log("this is father second")
            }
        }
    },
}

const define = {
    data()
    {
        this.count = 0
    },
    mixins: [father],
    props: {
        a: 1,
        b: {
            default()
            {
                return 2
            }
        },
        c: 100,
    },
    hooks: {
        start()
        {
            this.ant.console.log("this is start", this.a, this.b, this.c)
        },
        exit()
        {
            this.ant.console.log("this is exit")
        }
    },
    timers: {
        second: {
            interval: 1000,
            handler()
            {
                this.count++

                this.ant.console.log("timer[1s]", this.count, this.a, this.b, this.c, this.father_count)

                this.emit("changed")

                if (this.count == 3)
                {
                    this.ant.destroy()
                }
            }
        }
    }
}

module.exports = function (ant)
{
    ant.on("start", () =>
    {
        ant.add_comp(define, {
            c: "10",
            on: {
                changed()
                {
                    this.ant.console.log("changed", this.c)
                }
            }
        })
    })
}