module.exports = {
    workers: require("os").cpus().length,
    search: process.cwd(),
    boot: {
        template: "boot",
        args: []
    },
    plugins: []
    // debug: true,
}