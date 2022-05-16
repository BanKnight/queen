module.exports = {
    workers: 1,
    search: process.cwd(),
    boot: {
        template: "boot",
        args: []
    },
    // agent: { template: "agent", args: [], meta: { name: "@agent" } },
    plugins: [],
    debug: true,
}