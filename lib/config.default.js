module.exports = {
    workers: require("os").cpus().length,
    search: process.cwd(),
    boot: {
        template: "boot",
        args: []
    },
    // agent: { template: "agent", args: [], options: { name: "@agent" } },
    plugins: [],
    // debug: true,
}