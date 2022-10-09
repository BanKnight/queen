export default {
    props: {
        name: "unknown name"
    },
    hooks: {
        async start()
        {
            console.log("this is", this.name)
        }
    },
    remotes: {
        echo(from)
        {
            return from + " world"
        }
    }
}