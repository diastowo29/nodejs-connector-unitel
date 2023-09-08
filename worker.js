let throng = require('throng');
const axios = require('axios');
const service = require('./payload/service')
const cifhelper = require('./payload/cifhelper')
const logz = require('./logging/apps-logger')
const USER_TICKET_ID = process.env.USER_TICKET_ID || '6681549599887';
const ZD_PUSH_API = process.env.ZD_PUSH_API || 'https://unitelgroup1680069631.zendesk.com/api/v2/any_channel/push'; //ENV VARIABLE
let maxJob = 20;
let workers = maxJob;
let maxJobsPerWorker = maxJob;
let workQueue = require('./config/redis.config')
var winston = require('winston');
const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6';
var { Loggly } = require('winston-loggly-bulk');
winston.add(new Loggly({
  token: LOGGLY_TOKEN,
  subdomain: "diastowo",
  tags: ["cif"],
  json: true
}));

function start() {
    workQueue.process(maxJobsPerWorker, async (job, done) => {
        if (job.data.type == 'single') {
            console.log('single');
            processMessage(job.data, done);
        } else {
            console.log('bulk');
            processMessageBulk(job.data, done);
        }
    });
}

async function processMessage (jobData, done) {
    let external_resource_array = [];
    let msg = jobData.body.message;
    let authToken = jobData.header['authorization'];
    let username = jobData.body.message.from.username;
    let userid = jobData.body.message.from.id;
    
    // (`cif-unitel-${userid}`,'info', 'PUSH', userid, body, username, `${body.instance_id}/${authToken}`);
    let logPayload = {
        process: 'TESTING',
        status: 'info',
        to: 'TESTING',
        cif_log_id: 'TESTING',
        push_id_token: 'TESTING',
        username: 'TESTING',
        message: 'TESTING',
        client: 'TESTING'
    }
    logz(winston, logPayload)

    var msgObj = await cifhelper.cifPayload(msg, jobData.body.brand_id, USER_TICKET_ID)
    external_resource_array.push(msgObj);
    msgObj = {};
    let pushPayload = service.pushConversationPayload(ZD_PUSH_API, authToken, jobData.body.instance_id, external_resource_array)
    console.log(JSON.stringify(pushPayload))
    /* axios(pushPayload).then((response) => {
        console.log(response)
    }, (error) => {
    //   goLogging(`cif-unitel-${userid}`, 'error', 'PUSH', userid, error, body.message.from.username, `${body.instance_id}/${authToken}`);
    }) */
}

async function processMessageBulk (jobData, done) {
    let external_resource_array = [];
    let msgs = jobData.body.messages;
    let instance_push_id = jobData.body.instance_id;
    let authToken = jobData.header['authorization'];
    let brand_id = jobData.body.brand_id;
    let customer = jobData.body.from;
    // goLogging(`cif-unitel-${customer.id}`, 'info', 'PUSH-MANY', customer.id, jobData.body, customer.username, `${instance_push_id}/${authToken}`);
    await msgs.slice().reverse().forEach(async msg => {
      var msgObj = await cifhelper.cifBulkPayload(msg, brand_id, USER_TICKET_ID, customer);
      external_resource_array.push(msgObj);
      msgObj = {};
    });
    let pushPayload = service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array);
    console.log(JSON.stringify(pushPayload))

    /* axios(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
    .then((response) => {
        console.log(response)
    }, (error) => {
      // console.log(error)
    //   goLogging(`cif-unitel-${customer.id}`, 'error', 'PUSH-MANY', customer.id, error, customer.username, `${jobData.body.instance_id}/${authToken}`);
    }) */
}

throng({ workers, start });