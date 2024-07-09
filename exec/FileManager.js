#!/usr/bin/env zx
'use strict';

class FileManager{
    static outputsDir = "Output";
    static tag = Date.now();
    static fileNames = {server: "serversOutput.txt", root: "rootOutput.txt" , Broker: "brokerOutput.txt"};
    static scriptExecDir = "exec_"+FileManager.tag;
    static performanceDir = `performance_results`
    static resultsDir = `${FileManager.outputsDir}/${FileManager.performanceDir}/results_${FileManager.tag}`;
    static ConfigDir = "configs";

    static async memorizeTag(){
        if(await FileManager.fileExists("./tag.json")){
            await $`rm ./tag.json`;
            await fs.appendFile("tag.json", JSON.stringify({"tag" : FileManager.tag}, null, 4), {flags: 'a'});
        }
        else{
            await fs.appendFile("tag.json",  JSON.stringify({"tag" : FileManager.tag}, null, 4), {flags: 'a'});
        }
    }

    static async getMemorizedMeshTag(){
        if(await FileManager.fileExists("./tag.json")){
            const data = await fs.readFile("./tag.json", 'utf8');
            const config = JSON.parse(data);
            const tag = config.tag;
            return tag;
        }
    }

    static async fileExists(filePath){
        const output = await $`test -f ${filePath} && echo "exists" || echo "not exists"`;
        if (output.stdout.trim() !== "exists"){
            return false;
        }
        return true;
    }

    static async dirExists(dirPath){
        const output = await $`[ -d ./${dirPath} ] && echo "exists" || echo "not exist"`;
        if (output.stdout.trim() !== "exists"){
            return false;
        }
        return true;
    }

    static async cleanConfig(testName){
        const config = FileManager.getConfigFile(testName);
        if(await FileManager.fileExists(config)){
            await $`rm ${config}`;
        }
    }
    
    static async writeConfig(content, testName){
        const config = FileManager.getConfigFile(testName);
        await FileManager.cleanConfig(testName);
        const configContent={
            "range" :content.range,
            "test": true,
            "localHost": content.localHost ?? true,
            "random": content.numberOfServers,
            "commands": [
                content.command
            ]
        };
        const jsonString = JSON.stringify(configContent, null, 4);
        await fs.appendFile(`${config}`, jsonString,{flags: 'a'});
    }

    static async getRootOutput(){
        if(await FileManager.fileExists("./tag.json")){
            const data = await fs.readFile("./tag.json", 'utf8');
            const config = JSON.parse(data);
            const tag = config.tag;
            return `./${FileManager.outputsDir}/exec_${tag}/${FileManager.fileNames.root}`;
        }
    }

    static async getServerOutput(){
        if(await FileManager.fileExists("./tag.json")){
            const data = await fs.readFile("./tag.json", 'utf8');
            const config = JSON.parse(data);
            const tag = config.tag;
            return `./${FileManager.outputsDir}/exec_${tag}/${FileManager.fileNames.server}`;
        }
    }

    static async getBrokerOutPut(){
        if(await FileManager.fileExists("./tag.json")){
            const data = await fs.readFile("./tag.json", 'utf8');
            const config = JSON.parse(data);
            const tag = config.tag;
            return `./${FileManager.outputsDir}/exec_${tag}/${FileManager.fileNames.Broker}`;
        }
    }

    static getConfigFile(testName){
        return `./${FileManager.ConfigDir}/config_${testName}.json`;
    }

    static async getResultFile(testName){
        return `./${FileManager.resultsDir}/${testName}.csv`;
    }

    static async autoMeshPreprocess(){
        const serverOutput = await FileManager.getServerOutput();
        const rootOutPut = await FileManager.getRootOutput();
        const brokerOutput = await FileManager.getBrokerOutPut();
        if(!await FileManager.dirExists(FileManager.outputsDir)){
            await $`mkdir ./${FileManager.outputsDir}`;
        }
        if(!await FileManager.dirExists(`${FileManager.outputsDir}/${FileManager.scriptExecDir}`)){
            await $`mkdir ./${FileManager.outputsDir}/${FileManager.scriptExecDir}`;
        }
        if(await FileManager.fileExists(brokerOutput)){
            await $`rm ${brokerOutput}`;
        }
        if(await FileManager.fileExists(serverOutput)){
            await $`rm ${serverOutput}`;
        }
        if(await FileManager.fileExists(rootOutPut)){
            await $`rm ${rootOutPut}`;
        }
    }

    static async throughPutPreprocess(){
        if(!await FileManager.dirExists(FileManager.outputsDir)){
            await $`mkdir ./${FileManager.outputsDir}`;
        }
        if(!await FileManager.dirExists(FileManager.ConfigDir)){
            await $`mkdir ./${FileManager.ConfigDir}`;
        }
        if(!await FileManager.dirExists(`${FileManager.outputsDir}/${FileManager.performanceDir}`)){
            await $`mkdir ./${FileManager.outputsDir}/${FileManager.performanceDir}`;
        }
        if(!await FileManager.dirExists(FileManager.resultsDir)){
            await $`mkdir ./${FileManager.resultsDir}`;
        }
    }

    static async writeResultToFile(file, content){
        await fs.appendFile(file, content, {flags: 'a'});
    }

    static async writeToFile(file, content){
        await fs.appendFile(file, content, {flags: 'a'});
    }

    static async writeToAllFiles(content){
        const serverOutput = await FileManager.getServerOutput();
        const rootOutPut = await FileManager.getRootOutput();
        const files = [serverOutput, rootOutPut];
        return Promise.all(files.map((file) => FileManager.writeToFile(file, content)));
    }
}

module.exports = FileManager;