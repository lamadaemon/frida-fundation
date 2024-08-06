# FridaFoundation

FridaFundation, a opensource software that allows you to use multiple source files
when using frida.

**This project is still WIP**

[![996.icu](https://img.shields.io/badge/link-996.icu-red.svg)](https://996.icu)
[![LICENSE](https://img.shields.io/badge/license-Anti%20996-blue.svg)](https://github.com/996icu/996.ICU/blob/master/LICENSE)

---

## Purpose

This project is useful when your script is going big.
This usually happen during reverse-engineering some C++ project 
that you may face reading a complex structure (class) in stdlib (like Vec or std::string).
Also this project can bring you Typescript support!

But you may ask, what's the difference between this project and `frida-compile`?

Basically, both can do the same thing, build bundles. 
The difference is that this project is more easy to use.
Check out the following table so you will know!

| /                | **FridaFundation** | frida-compile  |
|------------------|--------------------|----------------|
| Bundle creation  | ESBuild            | TSC            |
| Reload-on-Change | :white_check_mark: | :x:            |
| Dynamic Module   | :x: but Planned    | :x:            |
| Frida Extensions | :white_check_mark: | :x:            |
| Logging          | :white_check_mark: | :x:            |
| Performance      | ESBuild Level Fast | TSC Level Slow |
| Lightweight      | :sob:              | :grin:         |
| Type checking    | :sob:              | :grin:         |

## How to use

A recommend file stucture is given below
```
- remote/
    - init.js (entrypoint)
    - other scripts...
- ff.config.js (config file)

Alternatively if you need to communications between host and remote

- remote/
    - init.js (entrypoint)
    - other scripts...
- host/
    - my-command.js
    - other scripts...
- ff.config.js
```

### Install necessary packages

```
pnpm install frida-foundation
```

Typescript package is not required to use typescript in your project,
however it is recommended to install.
You should always invoke 'tsc -noEmit' to check types 
becuase ESBuild does not do type checking at all.

```
# Optional if you'd like to use Typescript
pnpm install typescript -D
```

### Create config file

You need to create a config file. Recommended name is 'ff.config.js'.
Use the following template to get started quickly.

```
const ff = require('frida-fundation')

const config = ff.defineConfig({
    entryPoint: 'remote/init.js'
    target: {
        package: 'com.example.app',
        source: 'usb' // or ip
    },
    
})

// Three methods to begin debugging

// attach if possible 
await ff.start(config)

// always spawn target App 
await ff.spawnApp(config)

// always attach target App 
await ff.attachApp(config)
```