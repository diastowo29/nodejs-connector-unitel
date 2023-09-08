var express = require('express');
var router = express.Router();
const service = require('../payload/service');
const unitel = require('../payload/unitel');
const cifhelper = require('../payload/cifhelper')
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require("fs");
var request = require('request');
const { body, header, validationResult } = require('express-validator');
let workQueue = require('../config/redis.config');

const EXT_CHAT_HOST = process.env.EXT_CHAT_HOST || 'xxx';
const EXT_CHAT_ENDPOINT = `${EXT_CHAT_HOST}`;
const EXT_CHAT_TOKEN = process.env.EXT_CHAT_TOKEN || 'xxx';
const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6';

var winston = require('winston');
var { Loggly } = require('winston-loggly-bulk');
let clientName = 'UNITEL-DEV';

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
	let recipient = Buffer.from(req.body.recipient_id, 'base64').toString('ascii');
  let username = recipient.split('::')[1];
  let userid = recipient.split('::')[2];
  let brandid = req.body.thread_id.split('-')[3];
  let msgid = `unitel-ticket-${userid}-channelback-${Date.now()}`;
  var cb_arr = [];
  // goLogging(`cif-unitel-${userid}`, 'info', 'CHANNELBACK', userid, req.body, username, '0/0');
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
            // goLogging(`cif-unitel-${userid}`, 'error', 'CHANNELBACK-401', userid, req.body, username, '0/0');
            res.status(401).send(response.data);
          }
        }
        if (i == 0) {
          // goLogging(`cif-unitel-${userid}`, 'info', 'CHANNELBACK', userid, {req: req.body.request_unique_identifier, res: response.data}, username, '0/0');
          res.status(200).send({
            external_id: msgid
          });	
        }
      }
    }, (error) => {
    	console.log('error')
      console.log(JSON.stringify(error))
      // goLogging(`cif-unitel-${userid}`, 'error', 'CHANNELBACK', userid, error.response, username, '0/0');
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
  request.get(fileUrl).pipe(res)
})

router.get('/file/:filename\.:ext?', async function(req, res, next) {
  res.sendStatus(200)
})

router.post('/push_many', body('brand_id').exists(),
  body('from.id').exists(),
  body('from.username').exists(),
  body('instance_id').exists(),
  header('authorization').exists(),
function(req, res, next) {
  let authToken = req.headers['authorization'];
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // goLogging(`0/0`, 'error', 'PUSH-MANY', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    workQueue.add({body: req.body, header: req.headers, type: 'bulk'});
    res.status(200).send({status: 'OK'});
  } catch (e) {
    // goLogging(`cif-unitel-${userid}`, 'error', 'CRASH-PUSH-MANY', userid, e, req.body.message.from.username, `${req.body.instance_id}/${authToken}`);
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
function(req, res, next) {
  let authToken = req.headers['authorization'];
  let userid = req.body.message.from.id;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // goLogging('0/0', 'error', 'PUSH', 'cif', req.body, 'cif', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    workQueue.add({body: req.body, header: req.headers, type: 'single'});
    res.status(200).send({status: 'OK'})
  } catch (e) {
    // goLogging(`cif-unitel-${userid}`, 'error', 'CRASH-PUSH', userid, e, req.body.message.from.username, `${req.body.instance_id}/${authToken}`);
    res.status(500).send({error: e})
  }
})

// function goLogging(id, status, process, to, message, name, pushtoken) {
//   winston.log(status, {
//     process: process,
//     status: status,
//     to: to,
//     cif_log_id: id,
//     push_id_token: pushtoken,
//     username: name,
//     message: message,
//     client: clientName
//   });
// }

module.exports = router;