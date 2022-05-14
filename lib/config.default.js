module.exports = {
    workers: require("os").cpus().length,
    search: process.cwd(),
    boot: {
        template: "boot",
        args: []
    },
    // agent: { template: "agent", args: [], meta: { name: "@agent" } },
    plugins: [],
    // debug: true,
}