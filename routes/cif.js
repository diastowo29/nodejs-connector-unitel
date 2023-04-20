var express = require('express');
var router = express.Router();
const service = require('../payload/service')
const unitel = require('../payload/unitel')
const cifhelper = require('../payload/cifhelper')
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require("fs");
var request = require('request');
const { body, header, validationResult } = require('express-validator');

const ZD_PUSH_API = process.env.ZD_PUSH_API || 'https://unitelgroup1680069631.zendesk.com/api/v2/any_channel/push'; //ENV VARIABLE
const EXT_CHAT_HOST = process.env.EXT_CHAT_HOST || 'xxx';
const EXT_CHAT_ENDPOINT = `${EXT_CHAT_HOST}`;
const EXT_CHAT_TOKEN = process.env.EXT_CHAT_TOKEN || 'xxx';
const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6';
const USER_TICKET_ID = process.env.USER_TICKET_ID || '6681549599887';
var winston = require('winston');
var { Loggly } = require('winston-loggly-bulk');
let clientName = 'UNITEL-PROD'

winston.add(new Loggly({
  token: LOGGLY_TOKEN,
  subdomain: "diastowo",
  tags: ["cif"],
  json: true
}));

// axiosRetry(axios, {
//   retries: 3,
//   retryCondition: (e) => {
//     return (
//       axiosRetry.isNetworkOrIdempotentRequestError(e) ||
//       e.response.status != 200
//     );
//   }
// })

/* GET home page. */
router.get('/manifest', function(req, res, next) {
    let host = req.hostname
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
    })
});

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
  let instance_push_id = req.body.instance_push_id
  let zd_token = req.body.zendesk_access_token
  let locale = req.body.locale
  let subdomain = req.body.subdomain
  let return_url = req.body.return_url

  res.render('admin', {
    title: 'CIF Admin',
    return_url: return_url,
    instance_push_id: instance_push_id,
    zendesk_access_token: zd_token,
    locale: locale,
    subdomain: subdomain
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

    let name = "Unitel Live Chat : " + req.body.bot_name
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
	let recipient = Buffer.from(req.body.recipient_id, 'base64').toString('ascii')
  let username = recipient.split('::')[1];
  let userid = recipient.split('::')[2];
  let brandid = req.body.thread_id.split('-')[3];
  let msgid = `unitel-ticket-${userid}-channelback-${Date.now()}`;
  var cb_arr = [];
  goLogging(`cif-unitel-${userid}`, 'info', 'CHANNELBACK', userid, req.body, username, '0/0');
  if (req.body.message) {
    var textPayload = service.pushBackPayload(
      EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
      unitel.replyPayload(msgid, 'text', req.body.message, brandid, username, userid))
    cb_arr.push(textPayload)
  }
  if (req.body['file_urls[]']) {
    if (!Array.isArray(req.body['file_urls[]'])) {
      req.body['file_urls[]'] = [req.body['file_urls[]']]
    }
    req.body['file_urls[]'].forEach(zdFile => {
      let fileType = cifhelper.fileExtValidator(zdFile);
      var filePayload = service.pushBackPayload(
        EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
        unitel.replyPayload(msgid, fileType, zdFile, brandid, username, userid))
      cb_arr.push(filePayload)
    });
  }

  cb_arr.forEach((cb, i) => {
    axios(cb).then((response) => {
      if (response.status == 200) {
        if (response.data.status == 'failed') {
          if (response.data.response == 'Unauthorized') {
            goLogging(`cif-unitel-${userid}`, 'error', 'CHANNELBACK-401', userid, req.body, username, '0/0');
            res.status(401).send(response.data);
          }
        }
        if (i == 0) {
          // goLogging('info', 'CHANNELBACK', userid, response.data, username, '0/0');
          res.status(200).send({
            external_id: msgid
          });	
        }
      }
    }, (error) => {
    	console.log('error')
      console.log(JSON.stringify(error))
      goLogging(`cif-unitel-${userid}`, 'error', 'CHANNELBACK', userid, error.response, username, '0/0');
      if (i == 0) {
        res.status(503).send({});
      }
    })
  });
})

router.get('/clickthrough', function(req, res, next) {
	res.status(200).send({});	
})

router.post('/file/:filename\.:ext?', function(req, res, next) {
  let fileUrl = req.query.source;
  // request.get(fileUrl).on('response', function(response) {
  //   console.log(response.statusCode)
  //   response.pause();
  //   if (response.statusCode == 200) {
  //     response.pipe(res)
  //   }
  // }).on('error', function(errRspn) {
  //   console.log('error')
  //   console.log(errRspn)
  // }).on('timeout', function(timeRspn) {
  //   console.log('timeout')
  //   console.log(timeRspn)
  // })
  request.get(fileUrl).pipe(res)
  // req.pipe(request(fileUrl)).pipe(res)
})

router.get('/file/:filename\.:ext?', async function(req, res, next) {
  // console.log(req.query)
  // console.log(req.params)
  res.sendStatus(200)
})

router.post('/push_many', body('brand_id').exists(),
  body('from.id').exists(),
  body('from.username').exists(),
  body('instance_id').exists(),
  header('authorization').exists(),
async function(req, res, next) {
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    goLogging(`0/0`, 'error', 'PUSH-MANY', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  
  let external_resource_array = [];
  let msgs = req.body.messages;
  let instance_push_id = req.body.instance_id;
  let authToken = req.headers['authorization'];
  let brand_id = req.body.brand_id;
  let customer = req.body.from;
  goLogging(`cif-unitel-${customer.id}`, 'info', 'PUSH-MANY', customer.id, req.body, customer.username, `${instance_push_id}/${authToken}`);
  await msgs.slice().reverse().forEach(async msg => {
    var msgObj = await cifhelper.cifBulkPayload(msg, brand_id, USER_TICKET_ID, customer);
    external_resource_array.push(msgObj);
    // console.log(msgObj)
    msgObj = {};
  });
  // console.log(external_resource_array)

  // res.status(200).send(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
  axios(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
  .then((response) => {
    res.status(200).send(response.data)
  }, (error) => {
    // console.log(error)
    goLogging(`cif-unitel-${customer.id}`, 'error', 'PUSH-MANY', customer.id, error, customer.username, `${req.body.instance_id}/${authToken}`);
    res.status(error.response.status).send({error: error})
  })
})

router.post('/push', body('brand_id').exists(),
  body('message.from.id').exists(),
  body('message.type').exists(),
  body('message.from.username').exists(),
  body('message.id').exists() , 
  body('instance_id').exists() ,
  header('authorization').exists(),
async function(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    goLogging('0/0', 'error', 'PUSH', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  
  let external_resource_array = [];
  let msg = req.body.message;
  let authToken = req.headers['authorization'];
  let username = req.body.message.from.username;
  let userid = req.body.message.from.id;
  
  goLogging(`cif-unitel-${userid}`,'info', 'PUSH', userid, req.body, username, `${req.body.instance_id}/${authToken}`);

	var msgObj = await cifhelper.cifPayload(msg, req.body.brand_id, USER_TICKET_ID)
	external_resource_array.push(msgObj);
  msgObj = {};
  // res.status(200).send(service.pushConversationPayload(ZD_PUSH_API, authToken, req.body.instance_id, external_resource_array))
  axios(service.pushConversationPayload(ZD_PUSH_API, authToken, req.body.instance_id, external_resource_array))
  .then((response) => {
    res.status(200).send(response.data)
  }, (error) => {
    // console.log(JSON.stringify(error))
    goLogging(`cif-unitel-${userid}`, 'error', 'PUSH', userid, error, req.body.message.from.username, `${req.body.instance_id}/${authToken}`);
    res.status(error.response.status).send({error: error})
  })
})

function goLogging(id, status, process, to, message, name, pushtoken) {
  winston.log(status, {
    process: process,
    status: status,
    to: to,
    log_id: id,
    push_id_token: pushtoken,
    username: name,
    message: message,
    client: clientName
  });
}

module.exports = router;