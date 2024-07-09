'use strict';

class TimeStamper {
    constructor() {
        this.timeStamp = 0;
    }

    getNextTimeStamp() {
        return ++this.timeStamp;
    }
}

module.exports = TimeStamper;