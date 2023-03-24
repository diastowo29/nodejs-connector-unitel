
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

module.exports = {
    pushConversationPayload
}