
const pushConversationPayload = function (pushApi, cifToken, pushId, extResources) {
    const cifPayload = {
        method: 'POST',
        url: pushApi,
        headers: {
            'Authorization': cifToken
        },
        data: {
            instance_push_id: pushId,
            external_resources: extResources
        }
    }

    return cifPayload;
}

const pushBackPayload = function (replyBackApi, chatToken, messagePayload) {
    const replybackPayload = {
        method: 'POST',
        url: replyBackApi,
        headers: {
            'Authorization': 'Bearer ' + chatToken
        },
        data: {
            message: messagePayload
        }
    }

    return replybackPayload;
}

const reportChannelbackError = function (pushApi, cifToken, pushId, extId, desc) {
    const cifPayload = {
        method: 'POST',
        url: pushApi,
        headers: {
            'Authorization': cifToken
        },
        data: {
            instance_push_id: pushId,
            external_id: extId,
            description: desc
        }
    }

    return cifPayload;
}

module.exports = {
    pushConversationPayload,
    pushBackPayload,
    reportChannelbackError
}