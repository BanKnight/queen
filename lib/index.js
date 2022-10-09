import { Application } from "./Application.js"
import { WorkerApplication } from "./WorkerApplication.js"

import { isMainThread, workerData } from 'worker_threads';

import { Ant } from "./Ant.js"
import { Component } from "./Component.js"

export function create(config)
{
    if (isMainThread)
    {
        return new Application(config)
    }

    return new WorkerApplication(config, workerData.index)
}

export
{
    Application,
    WorkerApplication,
    Ant,
    Component
}