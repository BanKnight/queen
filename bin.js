#!/usr/bin/env node
const path = require('path')
const queen = require("./lib")

const config_path = path.resolve(process.cwd(), process.argv[2] || "config")
const config = require(config_path)

queen.run(config)