const doLogging = function (winston, payload) {
    winston.log(payload.status, {
      process: payload.process,
      status: payload.status,
      to: payload.to,
      cif_log_id: payload.id,
      push_id_token: payload.pushtoken,
      username: payload.name,
      message: payload.message,
      client: payload.clientName
    });
}

module.exports = doLogging