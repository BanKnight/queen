#!/usr/bin/env node
const path = require('path')
const queen = require("./lib")

let config_path = path.resolve(process.cwd(), process.argv[2] || "config")
let config = null

try
{
    config = require(config_path)
}
catch (error)
{
    console.log("//config does not exist,going to use default config")
}

queen.run(config)

