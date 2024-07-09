#!/usr/bin/env zx

import { ArgvCheck } from './preprocessing/ArgvCheck.mjs';
import { Mesh } from './setup/Mesh.mjs';
import { CommandManager } from './exec/CommandManager.mjs';

const Tracer = require('../src/utils/Tracer');
const TimeStamper = require('./exec/TimeStamper');
const FileManager = require('./exec/FileManager');

const numberServers = Number(`${argv.numberServers}`);
const range = Number(`${argv.range}`);
const config = `${argv.config}`;
const usrName = `${argv.usrName}`;

let localHost = argv.localHost === 'true' ? true : false;

const scriptID = 'AUTO_TEST_SCRIPT';
const scriptContext = 'zx';

Tracer.log(scriptID, `Number of servers: ${numberServers}, Range: ${range}, Config: ${config}, LocalHost: ${localHost}`, scriptContext);
Tracer.log(scriptID, argv.localHost);
await ArgvCheck.checkArgv(argv);
await FileManager.memorizeTag();
await FileManager.autoMeshPreprocess();

const configType = config === 'undefined' ? 'random' : 'config';
if (configType === 'config') {
    localHost = config.localHost;
}

const mesh = new Mesh(localHost , configType, usrName);

let args;
if (mesh.configType === 'random') 
    args = { numberOfServers: numberServers, range: range };
else if (mesh.configType === 'config')
    args = { config: config };

await mesh.start(args);

const timeStamper = new TimeStamper();
const commandManager = new CommandManager(mesh, timeStamper);

if (mesh.configType === 'config' && mesh.isAutoTest) 
    commandManager.validateCommands(mesh.commands);

async function autoTest() {
    for (let command of mesh.commands){
        await commandManager.commands[command.cmd]['execute'](command.args);
    }
    return 0;
}

if(mesh.isAutoTest){
    await autoTest();
    for(let [_, server] of mesh.servers) {
        if (mesh.localHost)
            server.kill('SIGINT');
        else 
            server.write(`killall -9 node\n`);
    }
    for(let [_, broker] of mesh.brokers) {
        if (mesh.localHost)
            broker.kill('SIGINT');
    }
    if (mesh.localHost)
        await $`pkill mosquitto`;
    process.exit(0);
}

while(true){
    let mode = Number(await question('choose Which mode you want to use:\n[1] Modification mode\n[2] Manual test mode\n[3] Help\n'));
    
    if (mode !== 1 && mode !== 2 && mode != 3) {
        Tracer.warn(scriptID, "the input should be either 1 or 2", scriptContext);
        continue;
    }
    else if (mode === 1) {
        while (true) {
            let modification = Number(await question('\nchoose the required action(choose a number between 1 - 3)\n[1] Add server\n[2] Add server(Bundle)\n[3] Remove Server\nPRESS ENTER TO GO BACK\n '));
            if (modification === 1) {
                let xLocation;
                let yLocation;
                let ip;
                let port;
                while(true){
                    while (true) {
                        xLocation = Number(await question(`input x coordinate (between 0 and ${mesh.range})\n`));
                        
                        if (xLocation >= 0 && xLocation <= mesh.range)
                            break;
                        else
                            Tracer.error(scriptID, "ERROR: coordinate out of range\n", scriptContext);
                    }
                    while (true) {
                        yLocation = Number(await question(`input y coordinate (between 0 and ${mesh.range})\n`));
                        
                        if (yLocation >= 0 && yLocation <= mesh.range)
                            break;
                        else
                            Tracer.error(scriptID, "ERROR: coordinate out of range\n", scriptContext);
                    }
                    if(mesh.isValidLocation({x: xLocation, y: yLocation})){
                        break;
                    }
                    else{
                        xLocation = -1;
                        yLocation = -1;
                        Tracer.error(scriptID, "TEMP ERROR: No Secondary region allowed. Chose wisely.\n", scriptContext);
                    }
                }
                if(!mesh.localHost){
                    ip = await question(`input the ip address\n`);
                }
                if(!mesh.localHost){
                    port = Number(await question(`input the port number\n`));
                }
                mesh.localHost ? await commandManager.commands['addServerInteractive']['execute']([xLocation, yLocation]) : await commandManager.commands['addServerInteractive']['execute']([xLocation, yLocation, ip, port])
                continue;
            }

            if (modification === 2) {
                let numberOfServers = Number(await question(`how many servers do you want to add?\n`));
                let ips;
                let ports;
                if(!mesh.localHost){
                    while(numberOfServers < ips.length){
                        let ip;
                        let port;
                        ip = await question(`What is the IP address you want to use for server number ${ips.length + 1}?\n`);
                        port = Number(await question(`What is the IPs address you want to use for server number ${ips.length + 1}?\n`));
                        ips.push(ip)
                        ports.push(port)
                    }
                }
                mesh.localHost ? await commandManager.commands['addServerBundle']['execute']([numberOfServers]) : await commandManager.commands['addServerBundle']['execute']([numberOfServers, ips, ports])
                continue;
            }

            if (modification === 3) {
                let serverId;
                while (true) {
                    serverId = await question(`input the serverID SBS_<col>_<row>\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(serverId)) 
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                await commandManager.commands['removeServer']['execute']([serverId]);
                continue;
            }

            if (!modification)
                break;
        }
    }
    else if(mode === 2) {
        let test;
        while (true) {
            test = Number(await question(`\nchoose The Test you want to use(a number between 1 - 10):\n
                    [1] Query Test\n
                    [2] Targeted group query\n
                    [3] Targeted singular query\n
                    [4] serving_region Test\n
                    [5] Targeted group serving_region\n
                    [6] Targeted singular serving_region\n
                    [7] explicit ping_block (default mode)\n
                    [8] explicit ping_block (custom mode)\n
                    [9] explicit ping region (default mode)\n
                    [10] explicit ping region (custom mode)\n
                    PRESS ENTER TO GO BACK\n`));
            
            if (test === 1)
                await commandManager.commands['exhaustiveQuery']['execute']();
            
            else if (test === 2) {
                let srcId;
                
                while (true) {
                    srcId = await question(`Enter the serverId of the server sending the query from\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }
                
                await commandManager.commands['groupQuery']['execute']([srcId]);
                continue;
            }

            else if (test === 3) {
                let srcId;
                let destId;

                while (true) {
                    srcId = await question(`Enter the serverId of the server sending the query from\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while (true) {
                    destId = await question(`Enter the serverId of the server sending the query to\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(destId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                await commandManager.commands['singularQuery']['execute']([srcId,destId]);
            }

            else if (test === 4) {
                await commandManager.commands['exhaustiveRegion']['execute']();
                continue;
            }

            else if (test === 5) {
                let srcId;

                while (true) {
                    srcId = await question(`Enter the serverId of the server sending the serving_region request \nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                await commandManager.commands['groupRegion']['execute']([srcId]);
                continue;
            }

            else if (test === 6) {
                let srcId;
                let destId;

                while (true) {
                    srcId = await question(`Enter the serverId of the server requesting the serving_region\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while(true) {
                    destId = await question(`Enter the serverId of the server recieving the serving_region request\nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(destId))
                        break;
                    else
                        Tracer.error(scriptID,"Server with this id does not exists in the mesh\n", scriptContext);
                }

                await commandManager.commands['singularRegion']['execute']([srcId, destId]);
                continue;

            }

            else if (test === 7) {
                let xLocation;
                let yLocation;
                let srcId;
                let pingMSG;

                while (true) {
                    srcId = await question(`Input the serverID for the server you want to ping with \nCurrent server Ids:\n${mesh.validIDs}:\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while (true) {
                    xLocation = Number(await question(`input the x coordinate that you want to ping(between 0 and ${mesh.range})\n`));
                    
                    if (xLocation >= 0 && xLocation <= mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yLocation = Number(await question(`input the y coordinate that you want to ping(between 0 and ${mesh.range})\n`));
                    
                    if (yLocation >= 0 && yLocation <= mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                pingMSG = await question(`input the message you are trying to ping with:\n`);
                await commandManager.commands['pingBlock']['execute']([xLocation,yLocation,srcId,pingMSG]);
            }

            else if (test === 8) {
                let xLocation;
                let yLocation;
                let srcId;
                let pingMSG;
                let number_pings;             
                let timeout;

                while (true) {
                    srcId = await question(`Input the serverID for the server you want to ping with \nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while (true) {
                    xLocation = Number(await question(`input the x coordinate that you want to ping(between 0 and ${mesh.range})\n`));
                    
                    if (xLocation >= 0 && xLocation <= mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yLocation = Number(await question(`input the y coordinate that you want to ping(between 0 and ${mesh.range})\n`));
                    
                    if (yLocation >= 0 && yLocation <= mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                number_pings = Number(await question(`Input number of pings\n`));
                pingMSG = await question(`input the message you are trying to ping with\n`);
                timeout = Number(await question(`Input the timeout\n`));
                
                await commandManager.commands['pingBlock']['execute']([xLocation,yLocation,srcId,pingMSG, number_pings,timeout]);
                continue;
            }

            else if (test === 9) {
                let xStart;
                let xEnd;
                let yStart;
                let yEnd;
                let pingMSG;
                let srcId;
                
                while (true) {
                    srcId = await question(`Input the serverID for the server you want to ping with \nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while (true) {
                    xStart = Number(await question(`input the starting point on x axis(between 0 and ${mesh.range})\n`));
                    
                    if (xStart >= 0 && xStart < mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    xEnd = Number(await question(`input the ending point on x axis(between ${xStart} and ${mesh.range})\n`));
                    
                    if (xEnd > 0 && xEnd <= mesh.range && xEnd > xStart)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yStart = Number(await question(`input the starting point on y axis(between 0 and ${mesh.range})\n`));
                    
                    if (yStart >= 0 && yStart < mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yEnd = Number(await question(`input the ending point on y axis(between ${yStart} and ${mesh.range})\n`));
                    
                    if (yEnd > 0 && yEnd <= mesh.range && yEnd > yStart)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                pingMSG = await question(`input the message you are trying to ping with\n`);

                await commandManager.commands['pingRegion']['execute']([xStart, xEnd, yStart, yEnd, srcId, pingMSG]);
                continue;
            }

            else if (test === 10) {
                let xStart;
                let xEnd;
                let yStart;
                let yEnd;
                let pingMSG;
                let number_pings;
                let timeout;
                let srcId;

                while (true) {
                    srcId = await question(`Input the serverID for the server you want to ping with \nCurrent server Ids:\n${mesh.validIDs}\n`);
                    
                    if (mesh.servers.has(srcId))
                        break;
                    else
                        Tracer.error(scriptID, "Server with this id does not exists in the mesh\n", scriptContext);
                }

                while (true) {
                    xStart = Number(await question(`input the starting point on x axis(between 0 and ${mesh.range})\n`));
                    
                    if (xStart >= 0 && xStart < mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    xEnd = Number(await question(`input the ending point on x axis(between ${xStart} and ${mesh.range})\n`));
                    
                    if (xEnd > 0 && xEnd <=mesh.range && xEnd > xStart)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yStart = Number(await question(`input the starting point on y axis(between 0 and ${mesh.range})\n`));
                    
                    if(yStart >= 0 && yStart < mesh.range)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                while (true) {
                    yEnd = Number(await question(`input the ending point on y axis(between ${yStart} and ${mesh.range})\n`));
                    if (yEnd > 0 && yEnd <= mesh.range && yEnd > yStart)
                        break;
                    else
                        Tracer.error(scriptID, "ERROR: coordinate out of range", scriptContext);
                }

                number_pings = Number(await question(`Input number of pings\n`));
                pingMSG =await question(`input the message you are trying to ping with\n`);
                timeout = Number(await question(`Input the timeout\n`));
                
                await commandManager.commands['pingRegion']['execute']([xStart, xEnd, yStart, yEnd, srcId, pingMSG, number_pings, timeout]);
                continue;
            }

            else if (!test)
                break;
        }
    }
    else {
        console.log(`Add server: add a server on the corresponding coordinate and port\n
                     Add server (Bundle): add servers on random locations.\n
                     Remove Server: remove a server with server ID\n
                     Query Test: every server query all available servers\n
                     Targeted group query: one server queries all the other servers\n
                     Targeted singular query: one server queries another server\n
                     serving_region Test: every server gets serving region of all servers\n
                     Targeted group serving_region : one server gets serving region of all the servers\n
                     Targeted singular serving_region: one server get serving_region of anoter server\n
                     explicit ping_block (default mode): a server pings the corresponding coordinate\n
                     explicit ping_block (custom mode): a server pings the corresponding coordinate multiple times with a set timeout\n
                     explicit ping region (default mode): a server pings the corresponding region\n
                     explicit ping region (custom mode): a server pings the corresponding region multiple times with a set timeout\n\n`)
    }
}





