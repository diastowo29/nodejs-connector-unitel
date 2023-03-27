var express = require('express');
var router = express.Router();
const service = require('../payload/service')
const axios = require('axios');
const fs = require("fs");
var request = require('request');
var fetch = require('node-fetch');

const ZD_PUSH_API = process.env.ZD_PUSH_API || 'https://pdi-rokitvhelp.zendesk.com/api/v2/any_channel/push'; //ENV VARIABLE

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
	let recipient = req.body.recipient_id.split('-')[2]
	// axios({
	//   method: 'POST',
	//   url: botSendMsgApi(),
	//   data: {
	//   	chat_id: recipient,
	//   	text: req.body.message
	//   }
	// }).then((response) => {
	// 	let ticket_external_id = 'telegram-ticket-' + response.data.result.chat.id + '-' + response.data.result.message_id
	// 	if (response.status == 200) {
	// 		res.status(200).send({
	// 			external_id: ticket_external_id
	// 		});	
	// 	}
	// }, (error) => {
	// 	console.log('error')
	// 	console.log(error.response.status)
	// 	res.status(error.response.status).send({});
	// });
})

router.get('/clickthrough', function(req, res, next) {
	res.status(200).send({});	
})

router.post('/file.jpeg', async function(req, res, next) {
  let sampleFile = 'https://static.remove.bg/sample-gallery/graphics/bird-thumbnail.jpg';
  // const { data } = await axios.get(sampleFile, { 
  //   responseType: "stream",
  //   headers: {
  //     'Content-type': 'application/octet-stream'
  //   }
  // });
  // res.setHeader('content-disposition', 'attachment; filename=\"logo.jpg\"')
  // // res.setHeader('Content-Type', 'image/jpeg')
  // data.pipe(res);

  // fetch(sampleFile).then((response) => {
  //     res.set({
  //       'Content-Length': response.headers.get('content-length'),
  //       'Content-Disposition': `inline;filename="file.jpg"`,        
  //       'Content-Type': response.headers.get('content-type'),        
  //     })
  //     response.body.pipe(res);
  //     response.body.on('error', () => {}) // To handle failure
  //   });

  request.get(sampleFile).on('response', function(response) {
    response.pause();
    if (response.statusCode == 200) {
      response.pipe(res)
    }
  })
  
  // var https = require('https');
  // https.get(sampleFile, remote_response => remote_response.pipe(res));
})

router.get('/file', async function(req, res, next) {
  let sampleFile = 'https://static.remove.bg/sample-gallery/graphics/bird-thumbnail.jpg';
  const { data } = await axios.get(sampleFile, { 
    responseType: "stream",
    headers: {
      'Content-type': 'application/octet-stream'
    }
  });
  // data.pipe(fs.createWriteStream("sample.jpg"));
  res.setHeader('content-disposition', 'attachment; filename=\"logo.jpg\"')
  // res.setHeader('Content-Type', 'image/jpeg')
  data.pipe(res);
  // res.download(data)

  // var https = require('https');
  // https.get(sampleFile, remote_response => remote_response.pipe(res));
})

router.post('/push', function(req, res, next) {
  let host = req.hostname
  if (!req.headers.authorization) {
    return res.status(403).json({ error: 'No credentials sent!' });
  }
  let external_resource_array = [];
	var msgObj = {}
  let msg = req.body.message
  let username = msg.from.username || msg.from.first_name;
	let ticket_external_id = `unitel-ticket-${msg.from.id}-${msg.id}-${Date.now()}`;
	let ticket_thread_id = `unitel-thread-${msg.from.id}`;
	let author_external_id = `unitel-author-${msg.from.id}`;
  let msg_type = msg.type;
  let msg_content = msg.content;
  let instance_push_id = req.body.instance_id;
  let authToken = req.headers['authorization']

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
    msgObj['message'] = `${msg_type} from User`;
    msgObj['file_urls'] = [`/api/v1/cif/file.jpeg`]
  }

	external_resource_array.push(msgObj);
  msgObj = {};
  axios(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
  .then((response) => {
    res.status(200).send({result: response.data})
  }, (error) => {
    console.log(error)
    res.status(200).send({error: error})
  })
  // res.status(401).send({error: 'Unauthorize'})
  // res.status(200).send(service.pushConversationPayload(ZD_PUSH_API, authToken, instance_push_id, external_resource_array))
})



module.exports = router;
