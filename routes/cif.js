var express = require('express');
var router = express.Router();
const service = require('../payload/service');
const axios = require('axios');
var request = require('request');
const { body, header, validationResult } = require('express-validator');
let workQueue = require('../config/redis.config');
let vars = require('../config/vars')
const LOGGLY_TOKEN = vars.LOGGLY_TOKEN;
let enableLogging = vars.ENABLE_LOG;
const ZD_HOST = vars.ZD_HOST;

var winston = require('winston');
var { Loggly } = require('winston-loggly-bulk');
let clientName = 'UNITEL-PROD';

const ZD_CB_ERR_API = ZD_HOST + '/api/v2/any_channel/channelback/report_error';

let dev = process.argv[2]

winston.add(new Loggly({
  token: LOGGLY_TOKEN,
  subdomain: "diastowo",
  tags: ["cif"],
  json: true
}));

let jobOpts = {
  removeOnComplete : true,
  removeOnFail: { 
    age: 86400 
  }
}

workQueue.on('global:failed', function (job, error) {
  workQueue.getJob(job).then(function(thisJob) {
    console.log('FAILED:', job)
    if (!dev) {
      try {
        if (thisJob.data.type != 'channelback') {
          let userId = '';
          let userName = '';
          if (thisJob.data.type == 'bulk') {
            userId = thisJob.data.body.from.id;
            userName = thisJob.data.body.username;
          } else {
            userId = thisJob.data.body.message.from.id;
            userName = thisJob.data.body.message.from.username;
          }
          let logId = `cif-unitel-${userId}`
          goLogging(logId, 'error', `PUSH-${thisJob.data.type}`, userId, { job:thisJob.id, body: thisJob.data.body, error: thisJob.failedReason}, userName, thisJob.data.auth);
        } else {
          let recipient = Buffer.from(thisJob.data.body.recipient_id, 'base64').toString('ascii');
          let userId = recipient.split('::')[2];
          // let msgId = thisJob.data.msgId;
          let metadata = JSON.parse(thisJob.data.body.metadata)
          let logId = `cif-unitel-${userId}`
          goLogging(logId, 'error', thisJob.data.type, userId, { job:thisJob.id, body: thisJob.data.body, error: thisJob.failedReason}, userId, metadata.zendesk_access_token);
          // axios(service.reportChannelbackError(ZD_CB_ERR_API, metadata.zendesk_access_token, metadata.instance_push_id, msgId, thisJob.failedReason));
        }
      } catch (e) {
        goLogging('0/0', 'error', `CRASH-QUEUE-EVENT`, thisJob.id, { body: thisJob.data.body, err: e }, 'NO_NAME', 'NO_AUTH');
      }
    }
  })
})

router.get('/check', function(req, res, next) {
  res.status(200).send({
    host: vars.ZD_HOST,
    ticket_fields_id: vars.TFIELDS_ID,
    ext_chat_host: vars.EXT_HOST,
    ext_chat_token: vars.EXT_TOKEN,
    loggly_token: vars.LOGGLY_TOKEN,
    enable_log: vars.ENABLE_LOG
  })
})

// axiosRetry(axios, {
//   retries: 3,
//   retryCondition: (e) => {
//     return (
//       axiosRetry.isNetworkOrIdempotentRequestError(e) ||
//       e.response.status != 200
//     );
//   }
// })

router.get('/manifest', function(req, res, next) {
  let host = req.hostname;
  res.send({
    name: "Unitel Chat",
    id: "trees-unitel-chat-integration",
    author: "Trees Solutions",
    version: "v1",
    push_client_id: "zd_trees_integration",
    channelback_files: true,
    create_followup_tickets: false,
    urls: {
      admin_ui: "https://" + host + "/api/v1/cif/admin",
      channelback_url: "https://" + host + "/api/v1/cif/channelback"
    }
  });
});

router.get('/jobs', function(req, res, next) {
  workQueue.getJobs().then(function(thisJob) {
    res.status(200).send(thisJob == null ? {} : thisJob)
  })
})

router.get('/job', function(req, res, next) {
  workQueue.getJob(req.query.job_id).then(function(thisJob) {
    res.status(200).send(thisJob == null ? {} : thisJob)
  })
})

router.get('/admin', function(req, res, next) {
  res.render('admin', {
    title: 'Unitel CIF Admin',
    return_url: 'return_url',
    instance_push_id: 'instance_push_id',
    zendesk_access_token: 'zd_token',
    locale: 'locale',
    subdomain: 'subdomain'
  });
})

router.post('/admin', function(req, res, next) {
  res.render('admin', {
    title: 'CIF Admin',
    return_url: req.body.return_url,
    instance_push_id: req.body.instance_push_id,
    zendesk_access_token: req.body.zendesk_access_token,
    locale: req.body.locale,
    subdomain: req.body.subdomain
  });
})

router.post('/add', function(req, res, next) {
	let metadata = {};
  metadata['instance_push_id'] = req.body.instance_push_id;
  metadata['zendesk_access_token'] = req.body.zendesk_access_token;
  metadata['subdomain'] = req.body.subdomain;
  metadata['locale'] = req.body.locale;
  metadata['return_url'] = req.body.return_url;
  metadata['bot_name'] = req.body.bot_name;

  let name = "Unitel Live Chat : " + req.body.bot_name;
  res.render('confirm', {
    title: 'CIF Confirmation Page',
    return_url: req.body.return_url,
    metadata: JSON.stringify(metadata),
    state: JSON.stringify({}),
    name: name
  });
})

router.post('/pull', function(req, res, next) {
	res.status(200).send();
})

router.post('/channelback', function(req, res, next) {
  try {
    let recipient = Buffer.from(req.body.recipient_id, 'base64').toString('ascii');
    let userid = recipient.split('::')[2];
    let msgId = `unitel-ticket-${userid}-channelback-${Date.now()}`;

    workQueue.add({body: req.body, type: 'channelback', msgId: msgId}, jobOpts);
    res.status(200).send({
      external_id: msgId
    });
  } catch (e) {
    // goLogging(`cif-unitel-${userid}`, 'error', 'CRASH-PUSH-MANY', userid, e, req.body.message.from.username, `${req.body.instance_id}/${authToken}`);
    res.status(500).send({error: e});
  }
})

router.get('/clickthrough', function(req, res, next) {
	res.status(200).send({});	
})

router.post('/file/:filename\.:ext?', function(req, res, next) {
  let fileUrl = req.query.source;
  request.get(fileUrl).on('error', function(err) {
    console.log('error on pipe')
    console.log(err);
    res.end();
  }).pipe(res);
  // try {
  // } catch (err) {
  //   console.log(err);
  //   res.status(200).send({});
  // }

})

router.get('/file/:filename\.:ext?', async function(req, res, next) {
  res.sendStatus(200)
})

router.post('/push_many', body('brand_id').exists(),
  body('from.id').exists(),
  body('from.username').exists(),
  body('instance_id').exists(),
  header('authorization').exists(),
async function(req, res, next) {
  let authToken = req.headers['authorization'];
  let userId = req.body.from.id;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    goLogging(`0/0`, 'error', 'PUSH-MANY', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let job = await workQueue.add({body: req.body, auth: req.headers['authorization'], type: 'bulk'}, jobOpts);
    res.status(200).send({status: 'OK', job: { id: job.id }});
  } catch (e) {
    goLogging(`cif-unitel-${userId}`, 'error', 'CRASH-PUSH-MANY', userId, e, req.body.from.username, `${req.body.instance_id}/${authToken}`);
    res.status(500).send({error: e});
  }
})

router.post('/push', body('brand_id').exists(),
  body('message.from.id').exists(),
  body('message.type').exists(),
  body('message.from.username').exists(),
  body('message.id').exists() , 
  body('instance_id').exists() ,
  header('authorization').exists(),
async function(req, res, next) {
  let authToken = req.headers['authorization'];
  let userid = req.body.message.from.id;
  const errors = validationResult(req);
  console.log(userid);
  if (!errors.isEmpty()) {
    goLogging('0/0', 'error', 'PUSH', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    console.log('PUSH JOB');
    let job = await workQueue.add({body: req.body, auth: req.headers['authorization'], type: 'single'}, jobOpts);
    console.log('JOB PUSHED')
    res.status(200).send({status: 'OK', job: { id: job.id }});
  } catch (e) {
    goLogging(`cif-unitel-${userid}`, 'error', 'CRASH-PUSH', userid, e, req.body.message.from.username, `${req.body.instance_id}/${authToken}`);
    res.status(500).send({error: e})
  }
})

function goLogging(id, status, process, to, message, name, pushtoken) {
  if (enableLogging) {
    winston.log(status, {
      process: process,
      status: status,
      to: to,
      cif_log_id: id,
      push_id_token: pushtoken,
      username: name,
      message: message,
      client: clientName
    });
  }
}

module.exports = router;