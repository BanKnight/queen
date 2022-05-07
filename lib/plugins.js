const path = require('path')

module.exports = function (config)
{
    let plugins = {
        ant: [],
        load: [],
    }

    function init()
    {
        for (const one of config.plugins)
        {
            const plugin = require(path.resolve(config.search, "plugins", one))

            for (const name in plugins)
            {
                if (plugins[name] && plugin[name])
                {
                    plugins[name].push(plugin[name])
                }
            }
        }

        if (plugins.load.length == 0)
        {
            plugins.load.push((name) =>
            {
                let file = path.resolve(config.search, name)
                return require(file)
            })
        }

        return plugins
    }

    function setup(name, ...args)
    {
        let array = plugins[name]

        let result = null

        for (const one of array)
        {
            result = one(...args)
        }

        return result
    }

    function load(...args)
    {
        let array = plugins.load

        let first = array[0]

        return first(...args)
    }

    init(config)

    return {
        setup,
        load
    }
}
