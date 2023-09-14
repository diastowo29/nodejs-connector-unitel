let throng = require('throng');
const axios = require('axios');
const service = require('./payload/service')
const unitel = require('./payload/unitel');
const cifhelper = require('./payload/cifhelper')
const USER_TICKET_ID = process.env.USER_TICKET_ID || '6681549599887';
const ZD_HOST = process.env.ZD_HOST || 'https://unitelgroup1694589998.zendesk.com'
const ZD_PUSH_API = ZD_HOST + '/api/v2/any_channel/push';
const EXT_CHAT_HOST = process.env.EXT_CHAT_HOST || 'xxx';
const EXT_CHAT_ENDPOINT = `${EXT_CHAT_HOST}`;
const EXT_CHAT_TOKEN = process.env.EXT_CHAT_TOKEN || 'xxx';

let maxJob = 5;
let workers = maxJob;
let maxJobsPerWorker = maxJob;
// let workQueue = require('./config/redis.config')
let Queue = require('bull');
let REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let workQueue = new Queue('sendMessage', REDIS_URL, {
    settings: {
        maxStalledCount: 0
    }
});

function start() {
    workQueue.process(maxJobsPerWorker, async (job, done) => {
        if (job.data.type == 'single') {
            processMessage(job.data, done);
        } else if (job.data.type == 'bulk') {
            processMessageBulk(job.data, done);
        } else {
            processChannelback(job.data, done);
        }
    });
}

/* TO ZENDESK */
async function processMessage (jobData, done) {
    try {
        let external_resource_array = [];
        let msg = jobData.body.message;
        let authToken = jobData.auth;
        var msgObj = await cifhelper.cifPayload(msg, jobData.body.brand_id, USER_TICKET_ID)
        external_resource_array.push(msgObj);
        msgObj = {};
        let pushPayload = service.pushConversationPayload(ZD_PUSH_API, authToken, jobData.body.instance_id, external_resource_array)
        axios(pushPayload).then((response) => {
            console.log('done sending message')
            done(null, {response: response.data});
        }, (error) => {
            done(new Error(error));
        });
    } catch (e) {
        throw new Error(e);
    }
}

/* TO ZENDESK */
async function processMessageBulk (jobData, done) {
    try {
        let external_resource_array = [];
        let msgs = jobData.body.messages;
        let instance_push_id = jobData.body.instance_id;
        let authToken = jobData.auth;
        let brand_id = jobData.body.brand_id;
        let customer = jobData.body.from;
        await msgs.slice().reverse().forEach(async msg => {
            var msgObj = await cifhelper.cifBulkPayload(msg, brand_id, USER_TICKET_ID, customer);
            external_resource_array.push(msgObj);
        });
        let pushPayload = service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array);
        axios(pushPayload)
        .then((response) => {
            console.log('done sending message')
            done(null, {response: response.data});
        }, (error) => {
            done(new Error(error));
        })
    } catch (e) {
        throw new Error(e);
    }
}

/* TO UNITEL */
async function processChannelback (jobData, done) {
    try {
        let recipient = Buffer.from(jobData.body.recipient_id, 'base64').toString('ascii');
        let userid = recipient.split('::')[2];
        let username = recipient.split('::')[1];
        let brandid = jobData.body.thread_id.split('-')[3];
        let msgId = `unitel-ticket-${userid}-channelback-${Date.now()}`;
        var cb_arr = [];
        if (jobData.body.message) {
            var textPayload = service.pushBackPayload(
              EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
              unitel.replyPayload(msgId, 'text', jobData.body.message, brandid, username, userid))
            cb_arr.push(textPayload)
        }
        if (jobData.body['file_urls[]']) {
            if (!Array.isArray(jobData.body['file_urls[]'])) {
              jobData.body['file_urls[]'] = [jobData.body['file_urls[]']]
            }
            jobData.body['file_urls[]'].forEach(zdFile => {
                let fileType = cifhelper.fileExtValidator(zdFile);
                var filePayload = service.pushBackPayload(
                    EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
                    unitel.replyPayload(msgId, fileType, zdFile, brandid, username, userid))
                cb_arr.push(filePayload)
            });
        }
        cb_arr.forEach((cb, i) => {
            axios(cb).then((response) => {
                if (response.status == 200) {
                    if (response.data.status == 'failed') {
                        done(new Error(response.data.response))
                    } else {
                        done(null, { response: response.data })
                    }
                }
            }, (error) => {
                done(new Error(e))
            })
        });
    } catch (e) {
        done(new Error(e))
    }
}

throng({ workers, start });