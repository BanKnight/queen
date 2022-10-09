//node entry.js simple
import { create } from "../lib/index.js";

const app = create({
    // threads: 2,
    boot: {
        template: process.argv[2]
    }
})

app.start()

process.on('uncaughtException', (err, origin) =>
{
    console.error(err)
});