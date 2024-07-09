'use strict';

import { $ } from 'zx';

/**
 * Utility class for cleaning files and directories.
 */
export class ArgvCheck {
    /**
     * Checks if the output directory exists.
     * @returns {Promise<void>}
     */
    static async checkArgv(argv) {
        if(Object.keys(argv).length === 3) {
            const configFile = await $`test -f ./${argv.config} && echo "exists" || echo "not exists"`;

            if (configFile.stdout.trim() !== "exists") 
                throw Error("Not a valid path for the config file");
        }

        else if(Object.keys(argv).length === 4 || Object.keys(argv).length === 5) {  
            if ((argv.numberServers === undefined || argv.range === undefined || argv.localHost === undefined))
                throw Error("ARGUMENT MISMATCH ERROR");
        }

        else {
            throw Error("ARGUMENT MISMATCH ERROR");
        }
    }
}