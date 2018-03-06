import Socket from './socket'
import {
	Type as MessageType
} from './message'
import RequestMessage from './requestMessage'
import SignalMessage from './signalMessage'
import SessionKey from './sessionKey'
import Parse from './parse'
import NamelessRequestMessage from './namelessReqMsg'

const supportedProtocolVersion = '1.1'

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

const activeClients = {}

export default function WebWireClient(_serverAddr, callbacks, defaultTimeout) {
	if (typeof _serverAddr !== "string" || _serverAddr.length < 1) throw new Error(
		"Invalid WebWire server address"
	)

	// Load client state for this server address if any
	const locStorKey = `webwire:${_serverAddr}`
	let state = localStorage.getItem(locStorKey)

	if (state != null) {
		state = JSON.parse(state)
		state.session = new SessionKey(state.session)
	}
	else state = {}

	// Verify if another client is already connected to this server
	if (activeClients[_serverAddr]) throw new Error(
		`Another WebWire client is already connected to host ${_serverAddr}`
	)
	else activeClients[_serverAddr] = true

	// Default request timeout is 60 seconds by default
	const _defaultTimeout = defaultTimeout ? defaultTimeout : 60000
	const _pendingRequests = {}
	let _session = state.session ? {key: state.session} : null
	let _conn = null
	let _isConnected = false

	const {
		onSignal: _onSignal,
		onSessionCreated: _onSessionCreated,
		onSessionClosed: _onSessionClosed
	} = getCallbacks(callbacks)

	// Define interface methods
	Object.defineProperty(this, 'connect', {value: connect})
	Object.defineProperty(this, 'request', {value: sendRequest})
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
				creationDate: _session.creationDate ?
					new Date(_session.creationDate.getTime()) : null,
				info: _session.info ? JSON.parse(JSON.stringify(_session.info)) : null
			}
		}
	})
	Object.defineProperty(this, 'pendingRequests', {
		get() {
			return _pendingRequests.length
		}
	})
	Object.freeze(this)

	function handleSessionCreated(session) {
		const sessionKey = new SessionKey(session.key)
		_session = {
			key: sessionKey,
			creationDate: new Date(session.crt),
			info: session.inf
		}

		// Save session key to local storage for automatic restoration
		const str = JSON.stringify({session: sessionKey.string})
		localStorage.setItem(locStorKey, str)

		// Provide copy of the actual session to preserve its immutability
		_onSessionCreated({
			key: sessionKey,
			creationDate: new Date(session.crt),
			info: session.inf
		})
	}

	function handleSessionClosed() {
		_session = null
		_onSessionClosed()
	}

	function handleFailure(message) {
		const req = _pendingRequests[message.id]

		// Ignore unexpected failure replies
		if (!req) return

		// Fail the request
		req.fail({
			code: message.error.c,
			message: message.error.m,
		})
	}

	function handleReply(message) {
		const req = _pendingRequests[message.id]

		// Ignore unexpected replies
		if (!req) return

		// Fulfill the request
		req.fulfill({
			encoding: message.encoding,
			payload: message.payload
		})
	}

	async function handleMessage(msgObj) {
		if (msgObj.size < 1) return

		const parsed = await Parse(msgObj)

		if (parsed.err != null) {
			console.warn("Failed parsing message:", parsed.err)
			return
		}

		// Handle message
		switch (parsed.type) {
		case MessageType.ReplyBinary:
		case MessageType.ReplyUtf8:
		case MessageType.ReplyUtf16:
			handleReply({
				id: parsed.msg.id,
				encoding: parsed.payloadEncoding,
				payload: parsed.msg.payload
			})
			break
		case MessageType.ErrorReply:
			handleFailure({
				id: parsed.msg.id,
				error: parsed.msg.reqError
			})
			break
		case MessageType.SignalBinary:
		case MessageType.SignalUtf8:
		case MessageType.SignalUtf16:
			_onSignal({
				name: parsed.msg.name,
				encoding: parsed.payloadEncoding,
				payload: parsed.msg.payload
			})
			break
		case MessageType.SessionCreated:
			handleSessionCreated(parsed.msg.session)
			break
		case MessageType.SessionClosed:
			handleSessionClosed()
			break
		default:
			console.warn("Strange message type received: ", parsed.type)
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

	// Sends a request containing the given payload to the server.
	// Returns a promise that is resolved when the server replies.
	// Automatically connects to the server if no connection has yet been established.
	// Optionally takes a timeout, otherwise default timeout is applied
	function sendRequest(name, payload, encoding, timeoutDuration) {
		// Connect before attempting to send the request
		return new Promise(async resolve => {
			const reqMsg = new RequestMessage(name, payload, encoding)
			const reqIdBytes = reqMsg.id.bytes

			let err = await connect()
			if (err != null) return resolve({err: err})
			let timeout = setTimeout(() => {
				// Deregister request
				delete _pendingRequests[reqIdBytes]
				timeout = null

				let newErr = new Error('Request timed out')
				newErr.code = 'TIMEOUT'
				resolve({err: newErr})
			}, timeoutDuration ? timeoutDuration : _defaultTimeout)
			const req = {
				fulfill(reply) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[reqIdBytes]
					clearTimeout(timeout)

					resolve({reply: reply})
				},
				fail(err) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[reqIdBytes]
					clearTimeout(timeout)

					resolve({err: err})
				}
			}

			// Register request
			_pendingRequests[reqIdBytes] = req

			// Send request
			_conn.send(reqMsg.bytes)
		})
	}

	function sendNamelessRequest(messageType, payload, timeoutDuration) {
		if (!_isConnected) return Promise.resolve({err: new Error("Not connected")})
		return new Promise(resolve => {
			const reqMsg = new NamelessRequestMessage(messageType, payload)
			const reqIdBytes = reqMsg.id.bytes

			let timeout = setTimeout(() => {
				// Deregister request
				delete _pendingRequests[reqIdBytes]
				timeout = null

				let newErr = new Error('Request timed out')
				newErr.code = 'TIMEOUT'
				resolve({err: newErr})
			}, timeoutDuration ? timeoutDuration : _defaultTimeout)
			const req = {
				fulfill(reply) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[reqIdBytes]
					clearTimeout(timeout)

					resolve({reply: reply})
				},
				fail(err) {
					// If the request already timed out then drop the reply
					if (timeout == null) return

					delete _pendingRequests[reqIdBytes]
					clearTimeout(timeout)

					resolve({err: err})
				}
			}

			// Register request
			_pendingRequests[reqIdBytes] = req

			// Send request
			_conn.send(reqMsg.bytes)
		})
	}

	async function tryRestoreSession(sessionKey) {
		const {reply, err: reqErr} = await sendNamelessRequest(
			MessageType.RestoreSession,
			sessionKey
		)
		if (reqErr != null) {
			// Just log a warning and still return null,
			// even if session restoration failed,
			// because we only care about the connection establishment in this method
			console.warn("WebWire client: couldn't restore session:", reqErr)

			// Reset the session
			_session = null
			localStorage.removeItem(locStorKey)
			return reqErr
		}
		const decodedSession = JSON.parse(reply.payload)
		_session = {
			key: new SessionKey(decodedSession.key),
			creationDate: new Date(decodedSession.crt),
			info: decodedSession.inf
		}
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

				if (_session == null) return resolve()

				// Try to automatically restore previous session
				const err = await tryRestoreSession(_session.key.bytes)
				if (err != null) console.warn(
					`WebWire client: couldn't restore session on reconnection: ${err}`
				)
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

	// Sends a signal containing the given payload to the server.
	// Automatically connects to the server if no connection has yet been established
	async function signal(name, payload, encoding) {
		const sigMsg = new SignalMessage(name, payload, encoding)

		// Connect before attempting to send the signal
		const err = await connect()
		if (err != null) return err
		_conn.send(sigMsg.bytes)
	}

	// Tries to restore the previously opened session.
	// Fails if a session is currently already active
	// Automatically connects to the server if no connection has yet been established
	async function restoreSession(sessionKey) {
		if (!(sessionKey instanceof SessionKey)) return new Error(
			"Expected session key to be an instance of SessionKey"
		)

		if (_session) return new Error("Can't restore session if another one is already active")
		// Connect before attempting to send the signal
		let connErr = await connect()
		if (connErr != null) return connErr
		const err = await tryRestoreSession(sessionKey.bytes)
		if (err != null) console.warn(
			`WebWire client: couldn't restore session by key (${sessionKey.string}) : ${err}`
		)
	}

	// Closes the currently active session.
	// Does nothing if there's no active session
	async function closeSession() {
		if (!_session || !_isConnected) {
			_session = null
			return
		}
		let {err: reqErr} = await sendNamelessRequest(
			MessageType.CloseSession,
			null
		)
		if (reqErr != null) return reqErr
		_session = null
		localStorage.removeItem(locStorKey)
	}

	// Gracefully closes the connection.
	// Does nothing if the client isn't connected
	function close() {
		_conn.close()
		_conn = null
	}
}
