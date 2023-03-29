const replyPayload = function (msgId, msgType, msgContent, brandId, username, userId) {
    const replybackPayload = {
        id: msgId,
        type: msgType,
        content: msgContent,
        brandId: brandId,
        to: {
            username: username,
            id: userId
        }
    }
    return replybackPayload;
}

module.exports = {
    replyPayload
}