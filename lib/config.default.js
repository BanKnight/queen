import { cpus } from 'os';

export default {
    search: process.cwd(),
    threads: cpus().length,
    boot: {
        template: "boot",
        inputs: { props: {}, },
        options: {}
    },
}