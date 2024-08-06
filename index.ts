import { BuildOptions } from 'esbuild'
import fs from 'fs'

export interface FridaFoundationConfig {
    /**
     * The entrypoint of your remote script.
     * Must be a path to a file.
     * 
     * Recommended project structure:
     *   - remote/
     *     - init.js or init.ts (entrypoint)
     *     - other files...
     *   - host/
     *     - ff.config.ts (your config file)
     *     - other files... (Command hooks)
     */
    entryPoint: string,

    target: {
        /**
         * The process name of the target application.
         */
        name?: string,
        /**
         * The process package name of the target application.
         */
        package: string,
        /**
         * The source of the target application.
         * 
         * - `usb`: Use remote device that is connected via USB, usually a phone.
         * - `local`: Use the local device
         */
        source: 'usb' | 'local',
    }

    /**
     * Where should the created bundle be saved.
     * Can be a file or a directory.
     * If a directory is provided, the bundle will be saved as `${output}/remote.bundle.js`.
     * 
     * This bundle file can be treated as a temporary file.
     * Default: `./remote.bundle.js`
     */
    output?: string,

    /**
     * Whether to minify the output bundle.
     * 
     * Default: `false`
     */
    minifyOutput?: boolean,

    /**
     * Whether to generate source map for the output bundle.
     * 
     * Default: `true`
     */
    sourceMap?: boolean,

    /**
     * Additional esbuild configuration.
     */
    esbuildConfig?: Omit<BuildOptions, 'entryPoints' | 'outfile' | 'format'>,
}

export function defineConfig(conf: FridaFoundationConfig): FridaFoundationConfig {
    return conf
}

export * from './host-server'
export * from './src/index'