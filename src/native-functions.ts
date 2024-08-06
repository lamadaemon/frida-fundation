import { createRemoteLogger } from "./logger"
const logger = createRemoteLogger("native-functions")

export type OffsetLike = NativePointerValue | UInt64 | Int64 | number | string
export type PatternLike = string | (number | null | string)[]

let functionNameTable: { [key in string]: PatternLike } = {

}

/**
 * Give a name to a function.
 * 
 * Support pure address like 0x123abcdef (this is relative to the module base)
 * Support pattern searching in the following formats:
 *  - "00 11 22 33" (space separated string)
 *  - "00 11 ?? ?? 33" (string with wildcards)
 *  - [ 0x00, 0x11, 0x22, 0x33 ] (array of numbers)
 *  - [ 0x00, 0x11, null, '??', 0x33 ] (array of numbers with wildcards)
 *    - null and '??' are interchangeable and represent a wildcard
 * 
 * After you have given a name to a function, you can use it in the `fn` function.
 * 
 * Example:
 * ```javascript
 * ff.nameFunction("ExampleApp::SomeFunction", ["??", null, "??", 00, 11, 22, 33, 44, ff])
 * ff.fn("libexample.so!ExampleApp::SomeFunction")
 * ```
 * 
 * @param name 
 * @param func 
 */
export function nameFunction(name: string, func: PatternLike) {
    functionNameTable[name] = func
}

/**
 * Get a module by its name.
 * @param mod 
 * @returns 
 */
Module.getModule = function(mod: string): Module | null {
    for (const i of Process.enumerateModules()) {
        if (i.name.endsWith(mod) || i.name.startsWith(mod)) {
            return i
        }
    }

    return null
}

/**
 * Get a NativePointer from a module and an offset.
 * 
 * @param module name of the module
 * @param offset offset to the base address of the module
 * @returns 
 */
export function fromOffset(module: string, offset: OffsetLike) {
    let baseAddr = Module.getBaseAddress(module)
    if (!baseAddr) return null;

    return baseAddr.add(offset)
}

/**
 * Get NativePointer of a function from a module.
 * Supported formats:
 *   - libmodule.so!function (Exported or named function)
 *   - libmodule.so!0x12345678 (Function address, euqaivalent to libmodule.so+0x12345678)
 *   - functionName (Fuzzy search, usually used on functions like malloc, free, open, etc)
 * @param name Name of function 
 * @returns 
 */
export function fn(name: string) {
    if (name.indexOf("!") === -1) {
        return Module.findExportByName(null, name)
    }

    let [mod, fnName] = name.split('!');

    if (functionNameTable[fnName]) {
        const data = functionNameTable[fnName]

        if (typeof data === 'string') {
            if (data.startsWith("0x")) { // Address is ensured
                return fromOffset(mod, functionNameTable[fnName] as string)
            } else if (data.includes(" ")) {
                const module = Module.getModule(mod)
                if (module === null) { 
                    return null
                }

                const addrs = Memory.scanSync(module.base, module.size, data).map(it => it.address)
                if (addrs.length < 1) {
                    return null
                } else if (addrs.length > 1) {
                    logger.info(`** WARNING ** Found ${addrs.length} matches for ${fnName}`)
                    return addrs[0]
                } else {
                    return addrs[0]
                }
            } else {
                return Module.findExportByName(mod, name)
            }
        } else {
            const targetMod = Module.getModule(mod)
            if (!targetMod) {
                return null
            }
                
            const addrs = Memory.scanSync(targetMod.base, targetMod.size, data.map((it) => {
                if (it === null || it === '??') {
                    return '??'
                } else {
                    return it.toString(16).padStart(2, "0")
                }
            }).join(' '))
            if (addrs.length < 1) {
                return null
            } else if (addrs.length > 1) {
                logger.info(`** WARNING ** Found ${addrs.length} matches for ${fnName}`)
                return addrs[0].address
            } else {
                return addrs[0].address
            }
        }
    }


    const fnPtr = Module.findExportByName(mod, fnName)
    if (fnPtr && fnPtr instanceof NativePointer) {
        return fnPtr
    }
  
    return fromOffset(mod, fnName)
}

/**
 * 
 * @param { bigint } member 
 */
export function findModuleByMember(member: bigint) {
    for (const mod of Process.enumerateModules()) {
        if (member >= BigInt(mod.base.toString()) && member <= BigInt(mod.base.add(mod.size).toString())) {
            return mod
        }
    }

    return null
}

export function dumpStacktrace(ctx: CpuContext) {
    const stacktraceRaw = Thread.backtrace(ctx)

    const callStack = stacktraceRaw.map(it => {
        const mod = findModuleByMember(BigInt(it.toString()))
        
        if (mod) {
            return `${mod.name}!0x${(it.sub(mod.base)).toString(16).toUpperCase()}`
        } else {
            return `0x${it.toString(16).toUpperCase()} (Unknown)`
        }
    })

    logger.info("")
    logger.info("Call stack:")
    for (let i = 0; i < callStack.length; i++) {
        logger.info(`  #${`${i}`.padEnd(`${callStack.length}`.length, ' ')} ${callStack[i]}`)
    }
    logger.info("")
}
