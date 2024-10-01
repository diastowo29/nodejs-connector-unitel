let Queue = require('bull');
let vars = require('./vars')
let REDIS_URL = vars.REDIS_URL;
let workQueue = new Queue('newSendMessage', {
    redis: {
        host: REDIS_URL.hostname,
        port: Number(REDIS_URL.port),
        password: REDIS_URL.password,
        tls: {
            rejectUnauthorized: false,
            requestCert: true,
            // agent: false, (not all clients accept this)
        },
    }
}, {
    settings: {
        maxStalledCount: 2
    }
});

module.exports=workQueue