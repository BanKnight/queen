let define = null

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

define = {
    data()
    {
        this.count = 0
    },
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
            interval: 5000,
            handler()
            {
                this.count++

                this.ant.console.log("this is 5 second", this.a, this.b, this.c, this.count)

                this.emit("changed")

                if (this.count == 3)
                {
                    this.ant.destroy()
                }
            }
        }
    }
}