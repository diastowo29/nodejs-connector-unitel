module.exports = {
    TFIELDS_ID: process.env.USER_TICKET_ID || '6681549599887',
    TRANSITION_FIELDS_ID: process.env.TRANSITION_TFIELDS_ID || '11658021114639',
    ZD_HOST: process.env.ZD_HOST || 'https://unitelgroup1694589998.zendesk.com',
    EXT_HOST: process.env.EXT_CHAT_HOST || 'xxx',
    EXT_TOKEN: process.env.EXT_CHAT_TOKEN || 'xxx',
    LOGGLY_TOKEN: process.env.LOGGLY_TOKEN || '25cbd41e-e0a1-4289-babf-762a2e6967b6',
    ENABLE_LOG: process.env.ENABLE_LOGGING || false,
    REDIS_URL : process.env.REDIS_URL || 'redis://127.0.0.1:6379'
};