module.exports = {
    workers: require("os").cpus().length,
    search: process.cwd(),
    boot: {
        template: "boot",
        args: []
    },
    // worker: { template: "worker", args: [], options: { name: "@worker" } },
    plugins: [],
    // debug: true,
}