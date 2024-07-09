#!/usr/bin/env zx
import { createInterface } from 'readline';
import { createReadStream } from 'fs';

const FileManager = require('./exec/FileManager');
const Intervals = [10,100,1000];
const serverNumbers = [15, 30, 45, 60];
const ExecutionTime = 10000;
const repeat = 5;
let serversOutput;
let RootOutput;
const localHost = argv.localHost === 'true' ? true : false;
const usrName = `${argv.usrName}`;
await FileManager.throughPutPreprocess();

async function countEchoPings(serversOutput){
    let echoPingCount = 0;
    const stream = createReadStream(serversOutput);
    const output = createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    for await (const line of output) {
        if (line.endsWith('ECHO PING')){
            echoPingCount++;
        }
    }
    output.close(); 
    stream.close(); 
    return echoPingCount;
}

async function countHop(serversOutput){
    let echoPingCount = 0;
    const stream = createReadStream(serversOutput);
    const output = createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    for await (const line of output) {
        if (line.includes('Sending msg to next hop')){
            echoPingCount++;
        }
    }
    output.close(); 
    stream.close(); 
    return echoPingCount;
}

async function getResult(serversOutput){
    const stream = createReadStream(serversOutput);
    const output = createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    for await (const line of output) {
        if (line.startsWith('Result')){
            const timeToAdd = line.split(":")[1];
            output.close(); 
            stream.close(); 
            return timeToAdd;
        }
    }
}

//num pings per one servers
async function performance_1(){
    const result = await FileManager.getResultFile("performance_1");
    const config = FileManager.getConfigFile("performance_1");
    const msg = "PingInterval,TotalNumServers,ExecutionTime,NumEchoPings,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let Interval of Intervals){
        for(let serverNumber of serverNumbers){
            let counter = 0;
            const command = {"cmd":"performance_1", "args": [Interval, ExecutionTime]};
            const configContent = {range: 10000, numberOfServers: serverNumber, command: command, localHost: localHost};
            await FileManager.writeConfig(configContent, "performance_1");
            while(counter < repeat){
                console.log("Iter number", counter);
                await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
                serversOutput = await FileManager.getServerOutput();
                RootOutput = await FileManager.getRootOutput();
                const pingCountServer = await countEchoPings(serversOutput);
                const pingCountRoot = await countEchoPings(RootOutput);
                const input= [Interval, serverNumber, ExecutionTime, pingCountServer+pingCountRoot, await FileManager.getMemorizedMeshTag()];
                await FileManager.writeResultToFile(result, input.join(',')+('\n'));
                setTimeout;
                counter++;
            }
        }
    }
}

async function performance_2(){
    const result = await FileManager.getResultFile("performance_2");
    const config = FileManager.getConfigFile("performance_2");
    const msg = "PingInterval,TotalNumServers,ExecutionTime,NumServersPinging,NumEchoPings,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let Interval of Intervals){
        console.log("Interval number", Interval);
        for(let serverNumber of serverNumbers){
            console.log("ServerNumber", serverNumber);
            let counter = 0;
            const command = {"cmd": "performance_2" , "args": [Interval, ExecutionTime, serverNumber]};
            const configContent = {range: 10000, numberOfServers: serverNumber, command: command, localHost: localHost};
            await FileManager.writeConfig(configContent , "performance_2");
            while(counter < repeat){
                console.log("Iter number",counter);
                await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
                serversOutput = await FileManager.getServerOutput();
                RootOutput = await FileManager.getRootOutput();
                const pingCountServer = await countEchoPings(serversOutput);
                const pingCountRoot = await countEchoPings(RootOutput);
                const input= [Interval, serverNumber, ExecutionTime, serverNumber, pingCountServer+pingCountRoot, await FileManager.getMemorizedMeshTag()];
                await FileManager.writeResultToFile(result, input.join(',')+('\n'));    
                setTimeout;
                counter++;
            }
        }
    }
}

async function performance_3(){
    const result = await FileManager.getResultFile("performance_3");
    const config = FileManager.getConfigFile("performance_3");
    const msg = "number of servers,HopsOnAverage,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let serverNumber of serverNumbers){
        console.log("ServerNumber", serverNumber);
        let counter = 0;
        const commands = {"cmd": "exhaustiveQuery", "args": []};
        const configContent = {range: 10000, numberOfServers: serverNumber, command: commands, localHost: localHost};
        await FileManager.writeConfig(configContent,"performance_3");
        while(counter < repeat){
            console.log("Iter number",counter);
            await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
            serversOutput = await FileManager.getServerOutput();
            RootOutput = await FileManager.getRootOutput();
            const serverHops = await countHop(serversOutput);
            const rootHops = await countHop(RootOutput);
            const input= [serverNumber, (serverHops+rootHops)/((serverNumber+1)*(serverNumber+1)), await FileManager.getMemorizedMeshTag()];
            await FileManager.writeResultToFile(result, input.join(',')+('\n'));
            setTimeout;
            counter++;
        }
    }
}

//avergae number of hops for exhaustiveRegion command
async function performance_4(){
    const result = await FileManager.getResultFile("performance_4");
    const config = FileManager.getConfigFile("performance_4");
    const msg = "number of servers,HopsOnAverage,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let serverNumber of serverNumbers){
        console.log("ServerNumber",serverNumber);
        let counter = 0;
        const command = {"cmd": "exhaustiveRegion", "args": []};
        const configContent = {range: 10000, numberOfServers: serverNumber, command: command, localHost: localHost};
        await FileManager.writeConfig(configContent, "performance_4");
        while(counter < repeat){
            console.log("Iter number",counter);
            await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
            serversOutput = await FileManager.getServerOutput();
            RootOutput = await FileManager.getRootOutput();
            const serverHops = await countHop(serversOutput);
            const rootHops = await countHop(RootOutput);
            const input= [serverNumber, (serverHops+rootHops)/((serverNumber+1)*(serverNumber+1)), await FileManager.getMemorizedMeshTag()];
            await FileManager.writeResultToFile(result, input.join(',')+('\n'));
            setTimeout;
            counter++;
        }
    }
}

async function performance_5(){
    const result = await FileManager.getResultFile("performance_5");
    const config = FileManager.getConfigFile("performance_5");
    const msg = "number of servers,TimeToAdd,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let serverNumber of serverNumbers){
        console.log("ServerNumber",serverNumber);
        let counter = 0;
        const command =  localHost ? {"cmd": "performance_5", "args": []} :  {"cmd": "performance_5", "args": []};
        const configContent = {range: 10000, numberOfServers: serverNumber, command: command, localHost: localHost};
        await FileManager.writeConfig(configContent, "performance_5");
        while(counter < repeat){
            console.log("Iter number",counter);
            await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
            serversOutput = await FileManager.getServerOutput();
            const timeToAdd = (await getResult(serversOutput));
            const input= [serverNumber,timeToAdd, await FileManager.getMemorizedMeshTag()];
            await FileManager.writeResultToFile(result, input.join(',')+('\n'));
            setTimeout;
            counter++;
        }
    }
}

async function performance_6(){
    const result = await FileManager.getResultFile("performance_5");
    const config = FileManager.getConfigFile("performance_5");
    const msg = "number of servers,TimeRemove,tag\n";
    await FileManager.writeResultToFile(result, msg);
    for(let serverNumber of serverNumbers){
        console.log("ServerNumber",serverNumber);
        let counter = 0;
        const command = {"cmd": "performance_6", "args": []};
        const configContent = {range: 10000, numberOfServers: serverNumber, command: command, localHost: localHost};
        await FileManager.writeConfig(configContent, "performance_5");
        while(counter < repeat){
            console.log("Iter number",counter);
            await $`./autoMesh.mjs --config ${config} --usrName ${usrName}`;
            serversOutput = await FileManager.getServerOutput();
            const timeToAdd = (await getResult(serversOutput));
            const input= [serverNumber,timeToAdd, await FileManager.getMemorizedMeshTag()];
            await FileManager.writeResultToFile(result, input.join(',')+('\n'));
            setTimeout;
            counter++;
        }
    }
}

await performance_2();