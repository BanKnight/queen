#!/usr/bin/env node
const path = require('path')
const queen = require("./lib")

let first = process.argv[2]

let config = null

if (first == "-c" || first == "--config" || first == null)           //指定配置
{
    let file = null

    try
    {
        file = require.resolve(path.resolve(process.argv[3] || "config"))
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

    if (file)
    {
        config = require(file)
    }
}
else if (first != null)        //默认配置
{
    config = {
        boot: {
            template: process.argv[2],
            args: process.argv.slice(3)
        }
    }
}

queen.run(config)