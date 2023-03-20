var express = require('express');
var router = express.Router();

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
        admin_ui: "https://" + host + "/cif/admin",
        channelback_url: "https://" + host + "/cif/channelback"
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

router.post('/pull', function(req, res, next) {
	res.status(200).send({});
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

router.post('/push', function(req, res, next) {
  let external_resource_array = [];
	var msgObj = {}
  let username = req.body.message.from.username || req.body.message.from.first_name;
	let ticket_external_id = 'unitel-ticket-' + req.body.message.from.id + '-' + req.body.message.message.id;
	let ticket_thread_id = 'unitel-thread-' + req.body.message.from.id;
	let author_external_id = 'unitel-author-' + req.body.message.from.id;
  let msg_type = req.body.message.type;
  let msg_content = req.body.message.content;

  msgObj = {
    external_id: ticket_external_id,
    message: msg_content,
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
	external_resource_array.push(msgObj);
  msgObj = {};
  res.status(200).send({
    external_resources: external_resource_array
  })
})

module.exports = router;
