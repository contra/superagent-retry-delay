/**
 * Add to the request prototype.
 */

module.exports = function (superagent) {
  const Request = superagent.Request

  Request.prototype.oldRetry = Request.prototype.retry
  Request.prototype.retry = retry
  Request.prototype.callback = callback

  return superagent
}

/**
 * Works out whether we should retry, based on the number of retries, on any passed
 * errors and response and compared against a list of allowed error statuses.
 *
 * @param {Number} retries
 * @param {Error} err
 * @param {Response} res
 */
function shouldRetry (err, res, allowedStatuses) {
  const ERROR_CODES = [
    'ECONNRESET',
    'ETIMEDOUT',
    'EADDRINFO',
    'ESOCKETTIMEDOUT',
    'ENOTFOUND'
  ]

  if (err && err.code && ~ERROR_CODES.indexOf(err.code)) {
    return true
  }

  if (res && res.status) {
    const status = res.status

    if (status >= 500) {
      return true
    }

    if ((status >= 400 || status < 200) && allowedStatuses.indexOf(status) === -1) {
      return true
    }
  }

  // Superagent timeout
  if (err && 'timeout' in err && err.code === 'ECONNABORTED') {
    return true
  }

  if (err && 'crossDomain' in err) {
    return true
  }

  return false
}

/**
 * Override Request callback to set a timeout on the call to retry.
 *
 * This overrides crucial behaviour: it will retry on ANY error (eg 401...) due to shouldRetry having
 * different behaviour.
 *
 * @param err
 * @param res
 * @return {Object}
 */
function callback (err, res) {
  if (this._maxRetries && this._retries++ < this._maxRetries && shouldRetry(err, res, this._allowedStatuses)) {
    var req = this
    return setTimeout(function () {
      return req._retry()
    }, this._retryDelay)
  }

  var fn = this._callback
  this.clearTimeout()

  if (err) {
    if (this._maxRetries) err.retries = this._retries - 1
    this.emit('error', err)
  }

  fn(err, res)
}

/**
 * Override Request retry to also set a delay.
 *
 * In miliseconds.
 *
 * @param {Number} retries
 * @param {Number} delay
 * @param {Number[]} allowedStatuses
 * @return {retry}
 */
function retry (retries, delay, allowedStatuses) {
  if (arguments.length === 0 || retries === true) {
    retries = 1
  }

  if (retries <= 0) {
    retries = 0
  }

  this._maxRetries = retries
  this._retries = 0
  this._retryDelay = delay || 0
  this._allowedStatuses = allowedStatuses || []

  return this
}
