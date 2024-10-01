let Queue = require('bull');
let vars = require('./vars')
let REDIS_URL = vars.REDIS_URL;
let workQueue = new Queue('newSendMessage', {
    redis: {
        password: process.env.REDIS_URL.split('@')[0].split(':')[2],
        host: process.env.REDIS_URL.split('@')[1].split(':')[0],
        port: parseInt(process.env.REDIS_URL.split('@')[1].split(':')[1]),
        tls: { rejectUnauthorized: false },
    }
}, {
    settings: {
        maxStalledCount: 2
    }
});

module.exports=workQueue