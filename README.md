# autoMesh Script

## Introduction
The `autoMesh` script is developed to offer an effective, descriptive, and user-friendly interface for `spaceBase`. This script is tailored to set up the required environment by automating mesh creation in a modular and flexible manner. It enables interactive and automated testing through a shell-like interface or a config file which allows you to modify the mesh or run different tests.

This document presents the functional details of the `autoMesh` script.

## Table of Contents
1. [Requirements](#requirements)
2. [Setup Instructions](#setup-instructions)
3. [Usage Instructions](#usage-instructions)
4. [autoMesh Script Tests](#automesh-script-tests)
5. [Configuration File Format](#configuration-file-format)
6. [Configuration File Example](#configuration-file-example)

## Requirements

1. Mosquitto broker
2. google/zx
3. Available port from 1883 to 1883+n for n being the number of servers you have on the mesh

## Setup Instructions

### Random Setup
Execute the following command to set up the environment with randomly placed servers and a root node:
```bash
./autoMesh.mjs --number <numberOfServers> --range <meshRange>
```
- `--number <numberOfServers>`: Specifies the number of servers being added to the mesh, excluding the root.
- `--range <meshRange>`: Defines the boundary within which servers can be randomly placed.

### Definitive Setup
For a more controlled setup, use the config file to specify exact server and root locations:
```bash
./autoMesh.mjs --config <ConfigRelativePath>
```
- `--config <ConfigRelativePath>`: The relative path to the configuration file which allows precise placement of the mesh nodes.

## Usage Instructions

### Interactive Version
Initiating the script with either a random setup or a definitive setup without a test field activates the interactive mode:
1. **Modification Mode**: Allows adding or removing servers within the mesh.
2. **Manual Test Mode**: Facilitates running various asynchronous or systematic tests.

### Automated Version
Using a configuration file with a 'test' field executes all included commands synchronously, requiring no further user interaction.

## autoMesh Script Tests
1. **addServerInteractive `<newPort> <xLocation> <yLocation>`**: Adds a server at specified coordinates. Available in interactive mode as `Add server(mass)`.
2. **addServerMass `<numberOfServers>`**: Adds a specified number of servers at random locations. Available in interactive mode as `Add server(mass)`.
3. **removeServer `<serverId>`**: Removes a specified server using its server ID. Available in interactive mode as `Remove Server`.
4. **exhaustiveQuery**: Each server queries all others. Available in interactive mode as `Query Test`.
5. **groupQuery `<srcId>`**: A server with `<srcId>` queries all available servers asynchronously. Available in interactive mode as `Targeted group query`.
6. **singularQuery `<srcId> <destId>`**: One server with `<srcId>` queries another server with `<destId>`. Available in interactive mode as `Targeted singular query`.
7. **exhaustiveRegion**: Each server retrieves the serving region of all available servers asynchronously. Available in interactive mode as `serving_region Test`.
8. **groupRegion `<srcId>`**: A server with `<srcId>` retrieves the serving region of all available servers. Available in interactive mode.`Targeted group serving_region`.
9. **singularRegion `<srcId> <destId>`**: A server with `<srcId>` retrieves the serving region of another server with `<destId>`. Available in interactive mode as `Targeted singular serving_region`.
10. **pingBlock `<xLocation> <yLocation> <srcId> <pingMSG>`**: A server pings a specific coordinate with the specified message. Available in interactive mode as `explicit ping_block(default mode)`.
11. **pingBlock `<xLocation> <yLocation> <srcId> <pingMSG> <number_pings> <timeout>`**: A server pings a specific coordinate with the specified message multiple times with a delay. Available in interactive mode as `explicit ping_block(custom mode)`.
12. **pingRegion `<xStart> <xEnd> <yStart> <yEnd> <srcId> <pingMSG>`**: A server pings a specified region with the specified message. Available in interactive mode `explicit ping region(default mode)`.
13. **pingRegion `<xStart> <xEnd> <yStart> <yEnd> <srcId> <pingMSG> <number_pings> <timeout>`**: A server pings a specified region with the specified message multiple times with a delay. Available in interactive mode as `explicit ping region(custom mode)`.
14. **performance_1 `<interval> <executionTime>`**: A Randomly selected server pings random blocks for `<executionTime>` time with `<interval>` interval. Not available in interactive mdode.
15. **performance_2 `<interval> <executionTime> <numberOfServers>`**:` <numberOfServers>` Randomly selected servers ping random blocks for `<executionTime>` time with `<interval>` interval. Not available in interactive mdode.

## Configuration File Format
The configuration file is a JSON object with the following keys:
- `"range"`: Specifies the mesh range as a number.
- `"random"`:Specifies the that the script should randomly assign the root and servers to the mesh. has a `Number` as it's value indecating number of servers(excluding root).
- `"rootCoords"`: Specifies the coordinates of the root node as an array.(Will be ignored if `Random` key is set to a number)
- `"serverCoords"`: Specifies the coordinates of each server in a two-dimensional array.(Will be ignored if `Random` key is set to a number)
- `"test"`: Indicates if the script should operate in automated or interactive mode as a boolean.
- `"commands"`: Specifies the commands to be executed synchronously if the test value is true.(Will be ignored if `test` key is not set or set to `false`)

## Configuration File Example 1 
deterministic setup for end-to-end tests. 
```json
{
    "range": 10000,
    "rootCoords": [5000, 5000],
    "serverCoords": [
        [0, 0],
        [700, 700],
        [9000, 9000]
    ],
    "test": true,
    "commands": [
        {"cmd": "pingRegion", "args": [0, 10000, 0, 10000, "SBS_0_0", "hi", 1, 2]},
        {"cmd": "pingBlock", "args": [700, 700, "SBS_0_0", "hey", 2, 12]},
        {"cmd": "pingBlock", "args": [700, 700, "SBS_0_0", "hish", 3, 20]}
    ]
}
```
## Configuration File Example 2
nondeterministic setup for performance tests.
```json
{
    "range": 10000,
    "test": true,
    "random": 5,
    "commands": [
        {
            "cmd": "performance_1",
            "args": [
                1,
                1000
            ]
        }
    ]
}
```





  

 


