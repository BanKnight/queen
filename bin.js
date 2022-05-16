#!/usr/bin/env node
const path = require('path')
const queen = require("./lib")

let first = process.argv[2] || "config"

let config = null

if (first == "-f" || first == "--file")
{
    config = {
        boot: {
            template: process.argv[3],
            args: process.argv.slice(4)
        }
    }
}
else
{
    let config_path = path.resolve(process.cwd(), process.argv[2] || "config")
    config = null

    try
    {
        config = require(config_path)
    }
    catch (error)
    {
        if (error.code == "MODULE_NOT_FOUND")
        {
            console.log("//config does not exist,going to use default config")
        }
        else
        {
            console.error(error)
            process.exit(1)
        }
    }
}

queen.run(config)