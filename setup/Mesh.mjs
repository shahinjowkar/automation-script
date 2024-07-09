#!/usr/bin/env zx

import constants from '../../src/utils/Constants.js';
import converter from '../../src/utils/CoordinateSystemConverter.js';
import Tracer from '../../src/utils/Tracer.js';
import FileManager from '../exec/FileManager.js';

import { Client } from 'ssh2';

const CURRENT_NODE_VERSION = 'v22.2.0';

const { SpaceBase } = constants;
const { ConvertSyntheticToSBlockCoordinateSystem, ConvertSyntheticRegionToSBlockRegion } = converter;

const availableResources = ['1', '6', '8', '9', '12', '13', '15', '18', '19', '21', '26', '28', '30', '31', '32', '33'];
const currentLocations= []
let serverOutput;
let rootOutPut;
let BrokerOutput;

export class Mesh {
    constructor(localHost, configType, usrName) {
        this.localHost = localHost;
        this.usrName = usrName;

        Tracer.log('mesh', `usrname ${this.usrName}`)
        this.configType = configType;
        this.isAutoTest = false;
        this.serverHosts = [];
        this.servers = new Map();
        this.brokers = new Map();
        this.meshRoot = null;
        this.validIDs = [];
    }

    async setPaths(){
        serverOutput = await FileManager.getServerOutput();
        rootOutPut = await FileManager.getRootOutput();
        BrokerOutput = await FileManager.getBrokerOutPut();
    }

    async start(args) {
        await this.setPaths()
        switch (this.configType) {
            case 'random': {
                Tracer.log('mesh', 'Random setup selected');
                await this.randomSetUp(args.numberOfServers, args.range);
                break;
            }
            case 'config': {
                Tracer.log('mesh', 'Config setup selected');
                await this.configSetUp(args.config);
                break;
            }
        }
    }

    removeServer(serverId) {
        if (this.servers.has(serverId)) {
            this.servers.delete(serverId);
            this.validIDs = this.validIDs.filter((id) => id !== serverId);
        }
    }

    autoSetupHostsLocal(numberHosts) {
        Tracer.log('mesh', 'Setting up local hosts');
        for (let i = 0; i < numberHosts; i++) {
            this.getNewHostLocal();
        }
    }

    configSetupHostsLocal(serversInfo) {
        if (SpaceBase.root.ip !== SpaceBase.defaultHost.localHost)
            throw Error('Local host should be used for local setup on root.');

        //Push root ip and port.
        this.serverHosts.push({ hostIp: SpaceBase.root.ip, port: SpaceBase.root.port });

        //Push the rest of the servers.
        for (const serverInfo of serversInfo) {
            if (serverInfo.ip !== SpaceBase.defaultHost.localHost)
                throw Error('Local host should be used for local setup');

            if (this.serverHosts.some((host) => { return host.port === serverInfo.port; }))
                throw Error('Port already in use');

            this.serverHosts.push({ hostIp: SpaceBase.defaultHost.localHost, port: serverInfo.port });
        }
    }

    async autoSetupHostsRemote(numberHosts) {
        Tracer.log('mesh', 'Setting up remote hosts');
        this.serverHostsSSHConnections = new Map();

        if (this.usrName === 'undefined')
            this.usrName = await question('Enter your cs username: \n');

        for (let i = 0; i < numberHosts; i++) {
            const trueIndx = i % availableResources.length;
            await this.getNewHostRemote(`open-gpu-${availableResources[trueIndx]}.cs.mcgill.ca`, SpaceBase.defaultHost.defaultPort);
        }

        if (!this.serverHostsSSHConnections.has(`${SpaceBase.root.ip}:${SpaceBase.root.port}`))
            throw new Error(`The root server should be running on ${SpaceBase.root.ip}:${SpaceBase.root.port}, but no remote machine is accessible for this address.`);
    }

    async setupHostsFromConfig(serversInfo) {
        Tracer.warn(`mesh`, `Manual setup of remote hosts is not yet available. Instead, fallbacking to automatic hosts setup.`);

        await this.autoSetupHostsRemote(serversInfo.length + 1);
        // for (const serverInfo of serversInfo ) {
        //     this.serverHosts.push({ hostIp: serverInfo.ip, port: serverInfo.port });
        // }
    }

    getNewHostLocal() {
        let newPort = SpaceBase.root.port + this.serverHosts.length;
        if (this.configType === 'config') {
            let foundNextPort = false;
            while(!foundNextPort) {
                if (this.serverHosts.some((host) => { return host.port === newPort; })) {
                    newPort++;
                    continue;
                }

                foundNextPort = true;
            }
        }

        const newHost = { hostIp: SpaceBase.defaultHost.localHost, port: newPort};
        this.serverHosts.push(newHost);

        return newHost;
    }
    
    async getNextAvailableHostRemote() {
        if (this.serverHosts.length < availableResources.length) {
            return await this.getNewHostRemote(`open-gpu-${availableResources[this.serverHosts.length]}.cs.mcgill.ca`, SpaceBase.defaultHost.defaultPort);
        }
        else {
            const randomIndex = Math.floor(Math.random() * (availableResources.length - 1));
            return await this.getNewHostRemote(`open-gpu-${availableResources[randomIndex]}.cs.mcgill.ca`, SpaceBase.defaultHost.defaultPort);
        }
    }

    async getNewHostRemote(ip , port) {
        let portNum = port;
        while (this.serverHosts.some((host) => { return host.hostIp === ip && host.port === portNum; }))
            portNum++;

        if (portNum > 1889)
            throw new Error(`No more available ports ${portNum}`);

        const newHost = { hostIp: ip , port: portNum };
        this.serverHosts.push(newHost);

        if (!this.usrName)
            throw new Error('Username not set');

        await new Promise((resolve, reject) => {
            const client = new Client();

            client.on('ready', () => {
                Tracer.log('mesh', `Connection established with ${newHost.hostIp}:${newHost.port}`);
                this.serverHostsSSHConnections.set(`${newHost.hostIp}:${newHost.port}`, client);
                resolve();
            });

            client.on('error', (error) => {
                Tracer.error('mesh', `Error connecting to ${newHost.hostIp}:${newHost.port}`, newHost.hostIp);
                reject(error);
            });

            client.connect({
                host: `${newHost.hostIp}`,
                username: `${this.usrName}`,
                privateKey: require('fs').readFileSync(`${process.env.HOME}/.ssh/id_ed25519`)
            });
        });

        return newHost;
    }

    isValidLocation(location){
        const SBlockCoords = ConvertSyntheticToSBlockCoordinateSystem(location);
        for(let currLocation of currentLocations){
            const distance = Math.sqrt((currLocation.col - SBlockCoords.col)**2 + (currLocation.row - SBlockCoords.row)**2)
            if(distance < 6){
                return false;
            }
        }
        return true;
        
    }

    addServerNoSec(hosts,numberOfServers){
        const serverPromises = [];
        for(let i = 0 ; i <numberOfServers; i++ ){
            let xLoc;
            let yLoc;
            while(true){
                xLoc = Math.floor(Math.random() * (this.range + 1));
                yLoc = Math.floor(Math.random() * (this.range + 1));
                if(this.isValidLocation({x: xLoc, y: yLoc})){
                    break
                }
            }
            
            serverPromises.push(this.addServer(hosts[i].hostIp, hosts[i].port, xLoc, yLoc));
        }
        return serverPromises;


    }

    async randomSetUp(numberOfServers, range) {
        this.range = range;
        if (this.localHost)
            this.autoSetupHostsLocal(numberOfServers);
        else 
            await this.autoSetupHostsRemote(numberOfServers);

        await FileManager.writeToAllFiles("####\nMesh Setup starting....\n####\n");
        await this.startBrokers();
        
        const rootxLocation= Math.floor(Math.random() * (range + 1));
        const rootyLocation = Math.floor(Math.random() * (range + 1));
        currentLocations.push(ConvertSyntheticToSBlockCoordinateSystem({x: rootxLocation, y: rootyLocation}))
        await this.startRoot(rootxLocation, rootyLocation);
        //check if the random location for the servers is valid for the servers
        const servers = this.serverHosts.filter((entry) => !(entry.hostIp === SpaceBase.root.ip && entry.port == SpaceBase.root.port));
        const serverPromises = this.addServerNoSec(servers, numberOfServers - 1)

        /**
        KEEPING THIS SINCE WE ARE GOING BACK TO IT ON NEXT ITTERATIONS
        ---------------------------------------------------------------
        const serverPromises = servers.map((entry) => [entry.hostIp, entry.port, Math.floor(Math.random() * (range + 1)), Math.floor(Math.random() * (range + 1))])
                                      .map((server) => this.addServer(server[0], server[1], server[2], server[3]));
        ---------------------------------------------------------------
        **/
        
        await Promise.all(serverPromises);
        await FileManager.writeToAllFiles("####\nMesh Setup has ended\n####\n\n");
    }  


    async configSetUp(config){
        config = require(config);
        const random = config.random;
        this.isAutoTest = config.test;
        this.range = config.range;
        this.localHost = config.localHost;
        this.commands = config.commands;
        if (random) {
            await this.randomSetUp(random, this.range);
            return;
        }
    
        const serversInfo = Object.values(config.serversInfo);
        if (this.localHost)
            this.configSetupHostsLocal(serversInfo);
        else 
            await this.setupHostsFromConfig(serversInfo);

        const rootxLocation = config.rootCoords[0];
        const rootyLocation = config.rootCoords[1];
        
        await FileManager.writeToAllFiles("####\nMesh Setup starting....\n####\n");
        
        await this.startBrokers();
        await this.startRoot(rootxLocation, rootyLocation);
        const serverPromises = (serversInfo.map((entry)=> this.addServer(entry.ip , entry.port, entry.coords[0], entry.coords[1])))
        await Promise.all(serverPromises);
        
        await FileManager.writeToAllFiles("####\nMesh Setup has ended\n####\n\n");
        return 0;
    }

    async startBrokers() {
        await new Promise(async (resolve) => {
            for (const host of this.serverHosts) {
                await this.startBroker(host);
            }

            resolve();
        });
    }

    async startBroker(host) {
        try {
            const brokerRunning = await this.brokerRunning(host);
            if (brokerRunning) 
                return;

            await new Promise((resolve) => {
                  Tracer.log('mesh', `About to execute start broker on ${host.hostIp}:${host.port}`);
                if (this.localHost) {
                    const broker = $`mosquitto -p ${host.port}`.quiet();

                    broker.stdout.pipe(fs.createWriteStream(BrokerOutput), { flags: 'a' });
                    broker.stderr.pipe(fs.createWriteStream(BrokerOutput), { flags: 'a' });

                    let brokerReady = false;
        
                    const listener = (data) => {
                        const message = data.toString();
                        if (message.includes('running') && !brokerReady) {   
                            brokerReady = true;
                            broker.stderr.removeListener('data', listener);
                            this.brokers.set(host.port, broker);
                            resolve(1); 
                        }
                    };
                    broker.stderr.on('data', listener);
                }
                else {
                    const sshConnection = this.serverHostsSSHConnections.get(`${host.hostIp}:${host.port}`);
                    sshConnection.exec(`mosquitto -c ~/SpaceBase/mosquitto/dist_conf_${host.port}.conf\n`, (err, stream) => {
                        if (err) 
                            throw err;
                
                        let brokerReady = false;
                        stream.on('close', () => {
                            Tracer.log(`mesh`, `Broker ${host.port} closed`);
                            resolve(1);
                        });
                
                        // Handle data received from the program
                        stream.on('data', (data) => {
                            const msg = data.toString();
                            Tracer.log('mesh', msg, host.hostIp);
                            if (msg.includes('running') && !brokerReady) {   
                                brokerReady = true;
                                this.brokers.set(host.port, broker);
                                Tracer.log('mesh', `Successfully started broker on port ${host.port}`, host.hostIp);
                                resolve(1);
                            }
                        });

                        stream.stderr.on('data', (data) => {    
                            const msg = data.toString();
                            Tracer.log('mesh', msg, host.hostIp);
                            if (msg.includes('running') && !brokerReady) {   
                                brokerReady = true;
                                this.brokers.set(host.port, broker);
                                Tracer.log('mesh', `Successfully started broker on port ${host.port}`, host.hostIp);
                                resolve(1);
                            }
                        });
    
                        const fileStream = fs.createWriteStream(`${BrokerOutput}`, { flags: 'a' });
                        stream.pipe(fileStream);
                    });
                }
            });
            
        }
        catch (error) {
            Tracer.error('mesh', `Error: ${error}`, host.hostIp);
            return;
        }
    }

    async brokerRunning(host) {
        try {
            if (this.localHost) {
                const stdout = await $`ps aux | grep mosquitto | grep ${host.port}`;
                const isBrokerRunning = stdout.stdout.includes(`mosquitto -p ${host.port}`);
                return isBrokerRunning;
            }
            else {
                const sshConnection = this.serverHostsSSHConnections.get(`${host.hostIp}:${host.port}`);
                let brokerRunning = false;
                await new Promise((resolve) => {
                    const command = `netstat -an | grep \":${host.port}\"`;
                    sshConnection.exec(command, (err, stream) => {
                        if (err) throw err;
                
                        stream.on('close', (code, signal) => {
                            Tracer.log(`mesh`, `Command [${command}] exited with code ${code}`, host.hostIp);
                            if (code == 1 && !brokerRunning) {
                                Tracer.log('mesh', `Mosquitto broker is not running on port ${host.port}`, host.hostIp);
                                resolve();
                            }
                        });
                
                        stream.on('data', (data) => {
                            const msg = data.toString();
                            Tracer.log('mesh', msg, host.hostIp);
                            if (msg.includes(`:${host.port}`) && msg.includes('LISTEN') && !brokerRunning) {
                                Tracer.log('mesh', `Mosquitto broker is running on port ${host.port}`, host.hostIp);
                                brokerRunning = true;
                                resolve();
                            }
                            else {
                                Tracer.log('mesh', `Mosquitto broker is not running on port ${host.port}`, host.hostIp);
                                brokerRunning = false;
                                resolve();
                            }
                        });
                    });
                });
                return brokerRunning;  
            }
        }
        catch (error) {
            return false;
        }
    }

    async startRoot(xLocation, yLocation) {
        Tracer.log('mesh', `Starting root at ${xLocation}, ${yLocation}`);
        let syntheticCoords = {x: xLocation, y: yLocation};
        let SBlockCoords = ConvertSyntheticToSBlockCoordinateSystem(syntheticCoords);
        
        let root = null;
        if (this.localHost) {
            root = $`node ../src/proxies/rootProxy ${xLocation} ${yLocation}`.quiet().stdio('pipe');

            root.stdout.pipe(fs.createWriteStream(`../scripts/${rootOutPut}`,  { flags: 'a' }));
            root.stderr.pipe(fs.createWriteStream(`../scripts/${rootOutPut}`,  { flags: 'a' }));
            return new Promise((resolve, reject) => {
                let rootReady = false;
    
                const listener = (data) => {
                    const message = data.toString();
                    if (message.includes('Connection status: CONNECTED') && !rootReady) {
                        rootReady = true;
                        root.stdout.removeListener('data', listener); 
                        resolve(1); 
                    }
                }
                root.stdout.on('data', listener);
    
                root.stdout.on('error', (error) => {
                    root.stdout.removeListener('data', listener);
                    reject(error);
                });
            }).then((result) => {
                this.assignRoot(root, SBlockCoords);
                return result;
            });
        }
        else {
            const sshConnection = this.serverHostsSSHConnections.get(`${SpaceBase.root.ip}:${SpaceBase.root.port}`);
            return new Promise((resolve) => {
                sshConnection.shell((err, stream) => {
                    if (err)
                        throw err;

                    let rootReady = false;
                    stream.on('close', () => {
                        Tracer.log(`mesh`, `Root ${xLocation} ${yLocation} closed`);
                    });

                    stream.on('data', (data) => {
                        const message = data.toString();
                        if (message.includes(CURRENT_NODE_VERSION) && !message.includes('PATH')) {
                            Tracer.log('mesh', `Node version is ${CURRENT_NODE_VERSION}`, SpaceBase.root.ip);
                            stream.write(`node ~/SpaceBase/src/proxies/rootProxy ${xLocation} ${yLocation}\n`);
                        }
                        if (message.includes('Connection status: CONNECTED') && !rootReady) {
                            rootReady = true;
                            this.assignRoot(stream, SBlockCoords);            
                            resolve(1);
                        }
                    });

                    stream.stderr.on('data', (data) => {
                        Tracer.error('mesh', data.toString());
                    });

                    const fileStream = fs.createWriteStream(`${rootOutPut}`, { flags: 'a' });
                    stream.pipe(fileStream);
                    stream.write(`node --version\n`);
                    //stream.write(`cd ~/pkgs\n`);
                    //stream.write(`echo \"export PATH=$HOME/pkgs/node-v22.2.0-linux-x64/bin:$PATH\" >> ~/.bashrc\n`);
                    stream.write(`source ~/.bashrc\n`);
                    //stream.write(`cd ..\n`);
                    stream.write(`node --version\n`);
                });
            });
        }
    }

    assignRoot(root, sblockCoords) {
        this.meshRoot = root;

        const rootId = `SB_Root_${sblockCoords.col }_${sblockCoords.row}`;
        this.servers.set(rootId , root);
        this.validIDs.push(rootId);
    }

    assignServer(server, sblockCoords) {
        const serverId = `SBS_${sblockCoords.col}_${sblockCoords.row}`;
        this.servers.set(serverId , server);
        this.validIDs.push(serverId);
        currentLocations.push(sblockCoords);
    }

    async addServer(ip, port, xLocation , yLocation){
        Tracer.log('mesh', `Starting server on ip ${ip} and port ${port} at ${xLocation}, ${yLocation}`);
        let syntheticCoords = {x: xLocation, y: yLocation};
        let SBlockCoords = ConvertSyntheticToSBlockCoordinateSystem(syntheticCoords);
        
        if (this.localHost) {
            const server = $`node ../src/proxies/serverProxy ${ip} ${port} ${xLocation} ${yLocation}`.quiet().stdio('pipe');
            
            server.stdout.pipe(fs.createWriteStream(`../scripts/${serverOutput}`,  { flags: 'a' }));
            server.stderr.pipe(fs.createWriteStream(`../scripts/${serverOutput}`,  { flags: 'a' }));
            
            return new Promise((resolve, reject) => {
                let serverReady = false;

                const listener = (data) => {
                    const message = data.toString();
                    if (message.includes('Successfully added server to mesh.') && !serverReady) {
                        serverReady = true;
                        server.stdout.removeListener('data', listener); 
                        resolve(1); 
                    }
                };
                server.stdout.on('data', listener);

                server.stdout.on('error', (error) => {
                    server.stdout.removeListener('data', listener);
                    reject(error);
                });
            }).then((result) => {
                this.assignServer(server, SBlockCoords);

                return result;
            });
        }
        else {
            const sshConnection = this.serverHostsSSHConnections.get(`${ip}:${port}`);
            return new Promise((resolve) => {
                sshConnection.shell((err, stream) => {
                    if (err)
                        throw err;

                    let serverReady = false;
                    stream.on('close', () => {
                        Tracer.log(`mesh`, `Server ${xLocation} ${yLocation} closed`, ip);
                    });

                    stream.on('data', (data) => {
                        const message = data.toString();
                        if (message.includes(CURRENT_NODE_VERSION) && !message.includes('PATH')) {
                            Tracer.log('mesh', `Node version is ${CURRENT_NODE_VERSION}`, ip);
                            stream.write(`node ~/SpaceBase/src/proxies/serverProxy ${ip} ${port} ${xLocation} ${yLocation}\n`);
                        }
                        if (message.includes('Successfully added server to mesh.') && !serverReady) {
                            serverReady = true;
                            this.assignServer(stream, SBlockCoords);            
                            resolve(1);
                        }
                    });

                    stream.stderr.on('data', (data) => {
                        Tracer.error(`mesh`, data.toString());
                    });

                    const fileStream = fs.createWriteStream(`${serverOutput}`, { flags: 'a' });
                    stream.pipe(fileStream);
                    stream.write(`node --version\n`);
                    //stream.write(`cd ~/pkgs\n`);
                    //stream.write(`echo \"export PATH=$HOME/pkgs/node-v22.2.0-linux-x64/bin:$PATH\" >> ~/.bashrc\n`);
                    stream.write(`source ~/.bashrc\n`);
                    //stream.write(`cd ..\n`);
                    stream.write(`node --version\n`);
                });
            });
        }
    }
}