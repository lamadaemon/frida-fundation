import frida, { ProcessID } from 'frida'
import fs from 'fs'
import esbuild from 'esbuild'
import { FridaFoundationConfig } from './index'
import { createHostLogger } from './src'

const logger = createHostLogger()
const esbuildLogger = createHostLogger("ESBuild")
let loadedScript: frida.Script | null = null

function getOutputFile(conf: FridaFoundationConfig) {
    if (conf.output) {
        if (fs.statSync(conf.output).isDirectory()) {
            return `${conf.output}/remote.bundle.js`
        } else {
            return conf.output
        }
    } else {
        return "./remote.bundle.js"
    }
}

async function getRemoteDevice(conf: FridaFoundationConfig): Promise<frida.Device> {
    if (conf.target.source === "usb") {
        return await frida.getUsbDevice()
    } else {
        return await frida.getLocalDevice()
    }
}

async function getTargetAppPID(device: frida.Device, conf: FridaFoundationConfig) {
    const processes = await device.enumerateProcesses()
    const targetProcess = processes.find(it => it.name === conf.target.name || it.name === conf.target.package)
    if (targetProcess) {
        return targetProcess.pid
    } else {
        throw new Error(`Target process not found: ${conf.target.name}`)
    }
}

async function spawnAppSession(device: frida.Device, conf: FridaFoundationConfig) {
    return await device.spawn(conf.target.package)   
}

async function getSession(device: frida.Device, conf: FridaFoundationConfig, attachPreference: 'always' | 'try' | 'never'): Promise<frida.Session> { 
    let pid = -1
    if (attachPreference === 'never') {
        pid = await spawnAppSession(device, conf)
    }

    try {
        pid = await getTargetAppPID(device, conf)
    } catch (ex) {
        if (attachPreference === 'try') {
            try {
                pid = await spawnAppSession(device, conf)
            } catch (exception) {
                throw new Error(`Failed to spawn or attach to target process: ${exception}`)
            }
        } else {
            throw ex
        }
    }

    if (pid === -1) {
        throw new Error(`Failed to get target process PID`)
    }

    return await device.attach(pid)
}


function walkWatch(target: fs.PathLike, triggerRebuild: fs.WatchListener<string>) {
    fs.watch(target, triggerRebuild)
    fs.readdirSync(target).forEach(it => {
        const fullPath = `${target}/${it}`
        if (fs.statSync(fullPath).isDirectory()) {
            walkWatch(fullPath, triggerRebuild)
        }
    })
}

async function launchRemoteScript(session: frida.Session, scriptFile: string) {
    const script = fs.readFileSync(scriptFile)
    if (loadedScript && !loadedScript.isDestroyed) {
        await loadedScript.unload()
    }

    loadedScript = await session.createScript(script.toString('utf-8'))
    loadedScript.message.connect((message, buffer) => {
        if (message.type === "error") { 
            logger.error(`(${Date.now()}) [Remote] Error: ${message.description}\n${message.stack}`)
            return
        }

    })

    await loadedScript.load()
}


export async function spawnApp(conf: FridaFoundationConfig) {
    return start(conf, 'never')
}

export async function attachApp(conf: FridaFoundationConfig) {
    return start(conf, 'always')
}

export async function buildBundle(ctx: esbuild.BuildContext): Promise<boolean> {

    try {
        const result = await ctx.rebuild()
        result.errors.forEach(err => esbuildLogger.log(`Error while building remote script: ${err}`))
        return true
    } catch (ex) {
        esbuildLogger.error(`Error while building remote script: ${ex}`)
        return false
    }
}

export async function start(conf: FridaFoundationConfig, attachPreference: 'always' | 'try' | 'never') {
    esbuildLogger.log(`Creating script bundle...`)

    const outfile = getOutputFile(conf)
    const esbuildCtx = await esbuild.context({
        entryPoints: [ conf.entryPoint ],
        bundle: true,
        minify: false,
        sourcemap: true,
        outfile,
        format: "cjs",
    })

    await buildBundle(esbuildCtx)


    const device = await getRemoteDevice(conf)
    let session: frida.Session | null = null
    for (let i = 0; i < 15; i++) {
        try {
            session = await getSession(device, conf, attachPreference)
        } catch {
            logger.log(`App not found, retrying in 1s...`)
            await (new Promise(resolve => setTimeout(resolve, 1000)))
            continue
        }
    }

    if (!session) {
        logger.error(`Failed to attach to target process after 15 retries! Giving up...`)
        return
    }

    await session.enableChildGating()

    let rebuilding = false
    walkWatch("./remote", async (event, filename) => {
        if (rebuilding) return
        if (session.isDetached) return

        rebuilding = true
        logger.clear()
        logger.log(`Script modification detected! Rebuilding...`)

        rebuilding &&= await buildBundle(esbuildCtx)

        logger.log(`Launching script...`)

        await launchRemoteScript(session, outfile)

        rebuilding = false
    })


    logger.log(`Launching script...`)
    await launchRemoteScript(session, outfile)

    await session.resume()
}
