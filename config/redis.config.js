let Queue = require('bull');
let vars = require('./vars')
let REDIS_URL = vars.REDIS_URL;
let workQueue = new Queue('sendMessage', REDIS_URL, {
    settings: {
        maxStalledCount: 0
    }
});

module.exports=workQueue