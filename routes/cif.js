var express = require('express');
var router = express.Router();
const service = require('../payload/service')
const unitel = require('../payload/unitel')
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require("fs");
var request = require('request');

const ZD_PUSH_API = process.env.ZD_PUSH_API || 'https://pdi-rokitvhelp.zendesk.com/api/v2/any_channel/push'; //ENV VARIABLE
const EXT_CHAT_HOST = process.env.EXT_CHAT_HOST || 'xxx';
const EXT_CHAT_ENDPOINT = `${EXT_CHAT_HOST}/webhooks/facebook/test/direct`;
const EXT_CHAT_TOKEN = process.env.EXT_CHAT_TOKEN || 'xxx';
const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6';
var mime = require('mime-types')
var winston = require('winston');
var { Loggly } = require('winston-loggly-bulk');
let clientName = 'UNITEL'

winston.add(new Loggly({
  token: "25cbd41e-e0a1-4289-babf-762a2e6967b6",
  subdomain: "diastowo",
  tags: ["cif"],
  json: true
}));

axiosRetry(axios, {
  retries: 3,
  retryCondition: (e) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(e) ||
      e.response.status != 200
    );
  }
})

/* GET home page. */
router.get('/manifest', function(req, res, next) {
    let host = req.hostname
    // goLogging('')

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
  console.log(JSON.stringify(req.body))
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
    metadata['bot_token'] = req.body.bot_token;
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
  // console.log(req.body)
	let recipient = Buffer.from(req.body.recipient_id, 'base64').toString('ascii')
  let username = recipient.split('-')[1];
  let userid = recipient.split('-')[2];
  let brandid = req.body.thread_id.split('-')[3];
  let msgid = `unitel-ticket-${userid}-channelback-${Date.now()}`;
  if (req.body.message) {
    var axPayload = service.pushBackPayload(
      EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
      unitel.replyPayload(msgid, 'text', req.body.message, brandid, username, userid))
    console.log(JSON.stringify(axPayload))
  }
  if (req.body['file_urls[]']) {
    if (!Array.isArray(req.body['file_urls[]'])) {
      req.body['file_urls[]'] = [req.body['file_urls[]']]
    }
    req.body['file_urls[]'].forEach(zdFile => {
      var fileType = getFileType(zdFile);
      var axPayload = service.pushBackPayload(
        EXT_CHAT_ENDPOINT, EXT_CHAT_TOKEN, 
        unitel.replyPayload(msgid, fileType, zdFile, brandid, username, userid))
      console.log(JSON.stringify(axPayload))
    });
  }
  // axios(axPayload).then((response) => {
  //   if (response.status == 200) {
  goLogging('info', 'CHANNELBACK', userid, req.body, username);
      res.status(200).send({
        external_id: msgid
      });	
  //   }
  // }, (error) => {
	// 	console.log('error')
	// 	console.log(error.response.status)
	// 	res.status(error.response.status).send({});
	// })
})

router.get('/clickthrough', function(req, res, next) {
	res.status(200).send({});	
})

router.post('/file/:string64/:filename\.:ext?', function(req, res, next) {
  let fileUrl = Buffer.from(req.params.string64, 'base64').toString('ascii')
  request.get(fileUrl).on('response', function(response) {
    response.pause();
    if (response.statusCode == 200) {
      response.pipe(res)
    }
  })
})

router.get('/file/:string64/:filename\.:ext?', async function(req, res, next) {
  let fileUrl = Buffer.from(req.params.string64, 'base64').toString('ascii')
  console.log(fileUrl)
  console.log(mime.extension(mime.lookup(fileUrl)))
  res.sendStatus(200)
})

router.post('/push', function(req, res, next) {
  // let sampleFile = 'https://static.remove.bg/sample-gallery/graphics/bird-thumbnail.jpg';
  let host = req.hostname
  if (!req.headers.authorization) {
    goLogging('error', 'PUSH', req.body.message.from.id, 'NO_TOKEN', req.body.message.from.username)
    return res.status(403).json({ error: 'No credentials sent!' });
  }
  goLogging('info', 'PUSH', req.body.message.from.id, req.body, req.body.message.from.username);
  let external_resource_array = [];
	var msgObj = {};
  let msg = req.body.message;
  let username = msg.from.username || msg.from.first_name;
	let ticket_external_id = `unitel-ticket-${msg.from.id}-${msg.id}-${Date.now()}`;
	let ticket_thread_id = `unitel-thread-${msg.from.id}-${req.body.brand_id}`;
	let author_external_id = Buffer.from(`unitel-${msg.from.username}-${msg.from.id}`).toString('base64');
  let msg_type = msg.type;
  let msg_content = msg.content;
  let instance_push_id = req.body.instance_id;
  let authToken = req.headers['authorization'];

  msgObj = {
    external_id: ticket_external_id,
    thread_id: ticket_thread_id,
    created_at: new Date().toISOString(),
    author: {
        external_id: author_external_id,
        name: username
    },
    fields:[{
      id: 'subject',
      value: 'Incoming Live Chat from: ' + username
    }],
    allow_channelback: true
  }

  if (msg_type == 'text') {
    msgObj['message'] = msg_content;
  } else {
    let ext = mime.extension(mime.lookup(msg_content))
    if (!ext) {
      msgObj['message'] = `Unsupported file ${msg_type} from User`;
      console.log('-- unsupported file type --')
    } else {
      msgObj['message'] = `${msg_type} from User`;
      msgObj['file_urls'] = [`/api/v1/cif/file/${Buffer.from(msg_content).toString('base64')}/users-file.${ext}`]
    }
  }

	external_resource_array.push(msgObj);
  msgObj = {};
  axios(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
  .then((response) => {
    res.status(200).send(response.data)
  }, (error) => {
    console.log(error)
    goLogging('error', 'PUSH', req.body.message.from.id, error, req.body.message.from.username);
    res.status(200).send({error: error})
  })
})

function getFileType (zdFile) {
  var fileType = '';
  switch (mime.lookup(zdFile)) {
    case 'image/jpeg':
      fileType = 'image'
      break;
    case 'image/png':
      fileType = 'image'
      break;
    case 'video/mp4':
      fileType = 'video'
      break;
    case 'video/mpeg':
      fileType = 'video'
      break;
    default:
      fileType = 'file'
      break;
  }
  return fileType;
}

function goLogging(status, process, to, message, name) {
  // if (inProd == 'false') {
    winston.log(status, {
      process: process,
      status: status,
      to: to,
      username: name,
      message: message,
      client: clientName
    });
  // }
}

module.exports = router;