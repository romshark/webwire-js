import Socket from './socket'
import UuidV4 from 'uuid/v4'

// TODO: implement UUIDv4 generation
function generateMessageIdentifier() {
	return UuidV4().replace(/-/g, "")
}

const supportedProtocolVersion = '1.0'

const MessageTypes = {
	// RestoreSession is sent by the client
	// to request session restoration
	RestoreSession: 'r',

	// SessionCreated is sent by the server
	// to notify the client about the session creation
	SessionCreated: 'c',

	// SessionClosed is sent by the server
	// to notify the client about the session destruction
	SessionClosed: 'd',

	// Signal is sent by both the client and the server
	// and represents a one-way signal message that doesn't require a reply
	Signal: 's',

	// Request is sent by the client
	// and represents a roundtrip to the server requiring a reply
	Request: 'q',

	// Reply is sent by the server
	// and represents a reply to a previously sent request
	Reply: 'p',

	// ErrorReply is sent by the server
	// and represents an error-reply to a previously sent request
	ErrorReply: 'e',

	// CloseSession is sent by the client
	// and requests the destruction of the currently active session
	CloseSession: 'x',
}

function getCallbacks(cbs) {
	let onSignal = function() {}
	let onSessionCreated = function() {}
	let onSessionClosed = function() {}

	if (cbs == null) return {
		onSignal,
		onSessionCreated,
		onSessionClosed
	}

	if (cbs.onSignal instanceof Function) onSignal = cbs.onSignal
	if (cbs.onSessionCreated instanceof Function) onSessionCreated = cbs.onSessionCreated
	if (cbs.onSessionClosed instanceof Function) onSessionClosed = cbs.onSessionClosed

	return {
		onSignal,
		onSessionCreated,
		onSessionClosed
	}
}

function extractMessageIdentifier(message) {
	return message.substring(1, 33)
}

export function Session(key, creationDate, info) {
	Object.defineProperty(this, 'key', {value: key})
	Object.defineProperty(this, 'creationDate', {value: creationDate})
	Object.defineProperty(this, 'info', {value: info})
}

export default function WebWireClient(_serverAddr, callbacks, defaultTimeout) {
	// Default request timeout is 60 seconds by default
	const _defaultTimeout = defaultTimeout ? defaultTimeout : 60000
	const _pendingRequests = {}
	let _session = null
	let _conn = null
	let _isConnected = false

	const {
		onSignal: _onSignal,
		onSessionCreated: _onSessionCreated,
		onSessionClosed: _onSessionClosed
	} = getCallbacks(callbacks)

	// Define interface methods
	Object.defineProperty(this, 'connect', {value: connect})
	Object.defineProperty(this, 'request', {value: request})
	Object.defineProperty(this, 'signal', {value: signal})
	Object.defineProperty(this, 'restoreSession', {value: restoreSession})
	Object.defineProperty(this, 'closeSession', {value: closeSession})
	Object.defineProperty(this, 'close', {value: close})

	// Define interface properties
	Object.defineProperty(this, 'isConnected', {
		get() {
			return _isConnected
		}
	})
	Object.defineProperty(this, 'session', {
		get() {
			if (_session) return {
				key: _session.key,
				creationDate: new Date(_session.creationDate.getTime()),
				info: JSON.parse(JSON.stringify(_session.info))
			}
		}
	})
	Object.defineProperty(this, 'pendingRequests', {
		get() {
			return _pendingRequests.length
		}
	})
	Object.freeze(this)

	function handleSessionCreated(message) {
		const jsonData = JSON.parse(message)
		_session = {
			key: jsonData.key,
			creationDate: jsonData.crt,
			info: jsonData.inf
		}

		// Provide copy of the actual session to preserve its immutability
		_onSessionCreated({
			key: jsonData.key,
			operatingSystem: jsonData.os,
			userAgent: jsonData.ua,
			creationDate: jsonData.crt,
			info: jsonData.inf
		})
	}

	function handleSessionClosed() {
		_session = null
		_onSessionClosed()
	}

	function handleFailure(message) {
		const requestIdentifier = extractMessageIdentifier(message)
		const req = _pendingRequests[requestIdentifier]

		// Ignore unexpected failure replies
		if (!req) return

		// Parse failure reply
		const payload = JSON.parse(message.substring(33))

		// Fail the request
		req.fail({
			code: payload.c,
			message: payload.m,
		})
		delete _pendingRequests[requestIdentifier]
	}

	function handleReply(message) {
		const requestIdentifier = extractMessageIdentifier(message)
		const req = _pendingRequests[requestIdentifier]

		// Ignore unexpected replies
		if (!req) return

		// Fulfill the request
		req.fulfill(message.substring(33))
		delete _pendingRequests[requestIdentifier]
	}

	function handleMessage(message) {
		if (message.length < 1) return

		// Extract message type
		const messageType = message.substring(0, 1)

		// Handle message
		switch (messageType) {
		case MessageTypes.Reply:
			handleReply(message)
			break
		case MessageTypes.ErrorReply:
			handleFailure(message)
			break
		case MessageTypes.Signal:
			_onSignal(message.substring(1))
			break
		case MessageTypes.SessionCreated:
			handleSessionCreated(message.substring(1))
			break
		case MessageTypes.SessionClosed:
			handleSessionClosed()
			break
		default:
			console.warn("Strange message type received: ", messageType)
			break
		}
	}

	// verifyProtocolVersion requests the endpoint metadata
	// to verify the server is running a supported protocol version
	async function verifyProtocolVersion() {
		// Initialize HTTP client
		const resp = await fetch('http://' + _serverAddr + '/', {
			method: 'WEBWIRE',
			cache: 'no-cache',
		})
		const metadata = await resp.json()
		const protoVersion = metadata['protocol-version']
		if (protoVersion !== supportedProtocolVersion) {
			return new Error(
				`Unsupported protocol version: ${protoVersion}` +
				`(${supportedProtocolVersion} is supported by this client)`
			)
		}
	}

	function sendRequest(messageType, payload, timeoutDuration) {
		// Connect before attempting to send the request
		return new Promise(async resolve => {
			let err = await connect()
			if (err != null) return resolve({err: err})
			const requestIdentifier = generateMessageIdentifier()
			let timeout = setTimeout(() => {
				// Deregister request
				delete _pendingRequests[requestIdentifier]
				timeout = null

				let newErr = new Error('Request timed out')
				newErr.code = 'TIMEOUT'
				resolve({err: newErr})
			}, timeoutDuration ? timeoutDuration : _defaultTimeout)
			const req = {
				fulfill(reply) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[requestIdentifier]
					clearTimeout(timeout)

					resolve({reply: reply})
				},
				fail(err) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[requestIdentifier]
					clearTimeout(timeout)

					resolve({err: err})
				}
			}

			// Register request
			_pendingRequests[requestIdentifier] = req

			// Send request
			if (payload == null) _conn.send(`${messageType}${requestIdentifier}`)
			else _conn.send(`${messageType}${requestIdentifier}${payload}`)
		})
	}

	/****************************************************************\
		Interface
	\****************************************************************/

	// Connects the client to the configured server and
	// returns an error in case of a connection failure
	function connect() {
		if (_isConnected) return Promise.resolve()
		return new Promise(async resolve => {
			const err = await verifyProtocolVersion()
			if (err != null) return resolve(
				new Error("Protocol version verification error: " + err)
			)

			_conn = new Socket("ws://" + _serverAddr + "/")
			_conn.onOpen(async () => {
				_isConnected = true

				// Try to automatically restore session if necessary
				if (_session == null) return resolve()
				const {reply, err: reqErr} = await sendRequest(
					MessageTypes.RestoreSession,
					_session.key
				)
				if (reqErr != null) {
					// Just log a warning and still return null,
					// even if session restoration failed,
					// because we only care about the connection establishment in this method
					console.warn(
						"WebWire client: couldn't restore session on reconnection: %s", err
					)

					// Reset the session
					_session = null
					return resolve()
				}
				_session = JSON.parse(reply)
				resolve()
			})
			_conn.onError(err => {
				console.error("WebWire client error:", err)
				resolve(new Error("WebSocket error: " + err))
			})
			_conn.onMessage(msg => handleMessage(msg))
			_conn.onClose(event => {
				_isConnected = false
				// See http://tools.ietf.org/html/rfc6455#section-7.4.1
				if (event.code !== 1000 && event.code !== 1001) console.error(
					"WebWire abnormal closure error: code: " + event.code
				)
			})
		})
	}

	// Sends a request containing the given payload to the server.
	// Returns a promise that is resolved when the server replies.
	// Automatically connects to the server if no connection has yet been established.
	// Optionally takes a timeout, otherwise default timeout is applied
	async function request(payload, timeout) {
		return await sendRequest(
			MessageTypes.Request,
			payload,
			timeout ? timeout : _defaultTimeout
		)
	}

	// Sends a signal containing the given payload to the server.
	// Automatically connects to the server if no connection has yet been established
	async function signal(payload) {
		// Connect before attempting to send the signal
		const err = await connect()
		if (err != null) return err
		_conn.send(MessageTypes.Signal + payload)
	}

	// Tries to restore the previously opened session.
	// Fails if a session is currently already active
	// Automatically connects to the server if no connection has yet been established
	async function restoreSession(sessionKey) {
		if (_session) return new Error("Can't restore session if another one is already active")
		// Connect before attempting to send the signal
		let connErr = await connect()
		if (connErr != null) return connErr
		let {resp, err: reqErr} = await sendRequest(MessageTypes.RestoreSession, sessionKey)
		if (reqErr != null) return reqErr
		_session = JSON.parse(resp.substring(33))
	}

	// Closes the currently active session.
	// Does nothing if there's no active session
	async function closeSession() {
		if (!_session || !_isConnected) {
			_session = null
			return
		}
		let {err: reqErr} = await sendRequest(MessageTypes.CloseSession, null)
		if (reqErr != null) return reqErr
		_session = null
	}

	// Gracefully closes the connection.
	// Does nothing if the client isn't connected
	function close() {
		_conn.close()
		_conn = null
	}
}
