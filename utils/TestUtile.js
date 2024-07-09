#!/usr/bin/env zx
'use strict';
class TestUtile {

    static getDistributedCoords(rage){
        const segSize = Math.floor(rage / 3)
        const distributedCoords = []
        for(let i = 0 ; i < 3 ; i++){
            for(let j = 0 ; j <3 ; j++){
                distributedCoords.push({x : i*segSize , y : j*segSize})
            
            }
        }
        return distributedCoords;
    }
}
module.exports = TestUtile;