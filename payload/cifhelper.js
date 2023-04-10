var mime = require('mime-types');
const axios = require('axios');
const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6';
var winston = require('winston');
var { Loggly } = require('winston-loggly-bulk');
let clientName = 'UNITEL'

winston.add(new Loggly({
  token: LOGGLY_TOKEN,
  subdomain: "diastowo",
  tags: ["cif"],
  json: true
}));

const cifBulkPayload = async function (msg, brand_id, user_ticket_id, customer) {
    // const replybackPayload = 
    // return replybackPayload;

    var msgObj = {};
    let username = msg.author.username || msg.author.first_name;
    let ticket_external_id = `unitel-ticket-${msg.author.id}-${msg.id}-${Date.now()}`;
    let ticket_thread_id = `unitel-thread-${customer.id}-${brand_id}`;
    let author_external_id = Buffer.from(`unitel::${msg.author.username}::${msg.author.id}`).toString('base64');
    let msg_timestamp = msg.timestamp.replaceAll(' ', '').replace('+0000', 'Z');
    let msg_type = msg.type;
    let msg_content = msg.content;
    
    msgObj = {
      external_id: ticket_external_id,
      thread_id: ticket_thread_id,
      created_at: msg_timestamp,
      author: {
          external_id: author_external_id,
          name: username
      },
      fields:[{
        id: 'subject',
        value: 'Incoming Live Chat from: ' + customer.username
      },{
        id: user_ticket_id,
        value: customer.id
      }],
      allow_channelback: true
    }
    // console.log(msgObj)

    if (msg_type == 'text') {
        if (msg_content == '') {
            msg_content = '- empty message -'
        }
        msgObj['message'] = msg_content.replaceAll('\"', '\'');
    } else {
      let ext = mime.extension(mime.lookup(msg_content))
      var fileMessage = '';
      if (!ext) {
        if (msg_type == 'image') {
          fileMessage = `${msg_type} from User`
          ext = 'jpeg';
        } else if (msg_type == 'video') {
          fileMessage = `${msg_type} from User`
          ext = 'mp4';
        } else {
          if (msg_type == 'file') {
            var tFile;
            try {
              tFile = await axios.get(decodeURIComponent(msg_content))
              if (mime.extension(tFile.headers['content-type'])) {
                fileMessage = `${msg_type} from User`
                ext = mime.extension(tFile.headers['content-type']);
              } else {
                fileMessage = `Unsupported ${msg_type} from User`;
              }
            } catch (err) {
              fileMessage = `Error getting ${msg_type} from User`;
              goLogging('error', 'FILE', msg.from.id, err, username);
            }
          }
        }
      } else {
        fileMessage = `${msg_type} from User`;
      }
      msgObj['message'] = fileMessage;
      if (ext) {
        // msgObj['file_urls'] = [`/api/v1/cif/file/${Buffer.from(msg_content).toString('base64')}/users-file.${ext}`]
        msgObj['file_urls'] = [`/api/v1/cif/file/users-file.${ext}?source=${msg_content}`]
      }
    }
    // if (msg.id == 'm_SxzMxgtBwLz7MFwDM4HLpaUB7M7hEy4XCvp95f6tT-_UYp-D_lC04uAutH5OReALVDxtz889e8bl5mZ5AEW1Pg') {
        // console.log(JSON.stringify(msgObj))
    // }
    return msgObj;
}

const cifPayload = async function (msg, brand_id, user_ticket_id) {
  var msgObj = {};
  let username = msg.from.username || msg.from.first_name;
	let ticket_external_id = `unitel-ticket-${msg.from.id}-${msg.id}-${Date.now()}`;
	let ticket_thread_id = `unitel-thread-${msg.from.id}-${brand_id}`;
	let author_external_id = Buffer.from(`unitel::${msg.from.username}::${msg.from.id}`).toString('base64');
  let msg_type = msg.type;
  let msg_content = msg.content;
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
    },{
      id: user_ticket_id,
      value: msg.from.id
    }],
    allow_channelback: true
  }

  if (msg_type == 'text') {
    msgObj['message'] = msg_content;
  } else {
    let ext = mime.extension(mime.lookup(msg_content))
    var fileMessage = '';
    if (!ext) {
      if (msg_type == 'image') {
        fileMessage = `${msg_type} from User`
        ext = 'jpeg';
      } else if (msg_type == 'video') {
        fileMessage = `${msg_type} from User`
        ext = 'mp4';
      } else {
        if (msg_type == 'file') {
          var tFile;
          try {
            tFile = await axios.get(decodeURIComponent(msg_content))
            if (mime.extension(tFile.headers['content-type'])) {
              fileMessage = `${msg_type} from User`
              ext = mime.extension(tFile.headers['content-type']);
            } else {
              fileMessage = `Unsupported ${msg_type} from User`;
            }
          } catch (err) {
            fileMessage = `Error getting file ${msg_type} from User`;
            goLogging('error', 'FILE', msg.from.id, err, username);
          }
        }
      }
    } else {
      fileMessage = `${msg_type} from User`;
    }
    msgObj['message'] = fileMessage;
    if (ext) {
      msgObj['file_urls'] = [`/api/v1/cif/file/users-file.${ext}?source=${msg_content}`]
    }
  }
  return msgObj;
}

function mimeGetter () {

}

const fileExtValidator = function (zdFile) {
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
  winston.log(status, {
    process: process,
    status: status,
    to: to,
    username: name,
    message: message,
    client: clientName
  });
}

module.exports = {
    cifBulkPayload,
    cifPayload,
    fileExtValidator
}