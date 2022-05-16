const { EventEmitter } = require('events');

const Ant = require('./Ant')
const Timer = require('./Timer')
const Component = require('./Component')

const All = Component(
    Timer(
        Ant(
            EventEmitter)
    ))

module.exports = All