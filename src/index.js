import Socket from './socket'
import {
	Type as MessageType,
} from './message'
import RequestMessage from './requestMessage'
import SignalMessage from './signalMessage'
import SessionKey from './sessionKey'
import Parse from './parse'
import NamelessRequestMessage from './namelessReqMsg'
import {
	onNode as getEndpointMetadataNode,
	onBrowser as getEndpointMetadataBrowser,
} from './getEndpointMetadata'
import parseEndpointAddress from './parseEndpointAddress'

const supportedProtocolVersion = '1.5'

function getCallbacks(opts) {
	let onSignal = function() {}
	let onSessionCreated = function() {}
	let onSessionClosed = function() {}
	let onDisconnected = function() {}
	let onConnected = function() {}

	if (opts == null || opts.handlers == null) {
		return {
			onSignal,
			onSessionCreated,
			onSessionClosed,
			onDisconnected,
			onConnected,
		}
	}

	const handlers = opts.handlers
	if (handlers.onSignal instanceof Function) {
		onSignal = handlers.onSignal
	}
	if (handlers.onSessionCreated instanceof Function) {
		onSessionCreated = handlers.onSessionCreated
	}
	if (handlers.onSessionClosed instanceof Function) {
		onSessionClosed = handlers.onSessionClosed
	}
	if (handlers.onDisconnected instanceof Function) {
		onDisconnected = handlers.onDisconnected
	}
	if (handlers.onConnected instanceof Function) {
		onConnected = handlers.onConnected
	}

	return {
		onSignal,
		onSessionCreated,
		onSessionClosed,
		onDisconnected,
		onConnected,
	}
}

const ClientStatus = {
	Disabled: 0,
	Disconnected: 1,
	Connected: 2,
	Connecting: 3,
}

function localStorageStateKey(hostname, port, endpoint) {
	const key = `${hostname}:${port}`
	if (endpoint) return `${key}${endpoint}`
	return key
}

function websocketEndpointUri(protocol, hostname, port, path) {
	// Determine websocket schema based on the endpoint protocol
	const wsSchema = protocol === 'https' ? 'wss' : 'ws'
	const base = `${wsSchema}://${hostname}:${port}`
	if (path) return `${base}${path}`
	return base
}

export default function WebWireClient(endpointAddress, options) {
	// Parse endpoint address
	const {
		protocol: _protocol,
		hostname: _hostname,
		port: _port,
		path: _endpointPath,
		err,
	} = parseEndpointAddress(endpointAddress)
	if (err) throw err

	// Determine the websocket endpoint URI
	const _websocketEndpointUri = websocketEndpointUri(
		_protocol,
		_hostname,
		_port,
		_endpointPath,
	)

	if (options == null) options = {}

	// Load client state for this server address if any
	const locStorKey = localStorageStateKey(_hostname, _port, _endpointPath)

	let state

	if (process.browser) state = localStorage.getItem(locStorKey)
	if (state != null) {
		state = JSON.parse(state)
		state.session = new SessionKey(state.session)
	} else {
		state = {}
	}

	// Default request timeout is 60 seconds by default
	const _defaultReqTimeout = options.defaultReqTimeout || 60000
	const _reconnInterval = options.reconnectionInterval || 2000
	const _autoconnect = options.autoconnect || true
	const _pendingRequests = {}
	let _session = state.session ? {key: state.session} : null
	let _conn = null
	let _status = ClientStatus.Disconnected
	let _reconnecting = null
	let _connecting = null
	let _heartbeatTimeout = null
	let _readTimeout = 60000

	const {
		onSignal: _onSignal,
		onSessionCreated: _onSessionCreated,
		onSessionClosed: _onSessionClosed,
		onDisconnected: _onDisconnected,
		onConnected: _onConnected,
	} = getCallbacks(options)

	// Define interface methods
	Object.defineProperty(this, 'connect', {value: connect})
	Object.defineProperty(this, 'request', {
		value: function(name, payload, encoding, timeoutDuration) {
			return sendRequest(null, name, payload, encoding, timeoutDuration)
		},
	})
	Object.defineProperty(this, 'signal', {value: signal})
	Object.defineProperty(this, 'restoreSession', {value: restoreSession})
	Object.defineProperty(this, 'closeSession', {value: closeSession})
	Object.defineProperty(this, 'close', {value: close})

	// Define interface properties
	Object.defineProperty(this, 'status', {
		get() {
			switch (_status) {
			case ClientStatus.Disabled: return 'disabled'
			case ClientStatus.Disconnected: return 'disconnected'
			case ClientStatus.Connected: return 'connected'
			case ClientStatus.Connecting: return 'connecting'
			}
			return 'invalid_client_status'
		},
	})
	Object.defineProperty(this, 'session', {
		get() {
			if (_session) {
				return {
					key: _session.key,
					creationDate: _session.creationDate
						? new Date(_session.creationDate.getTime()) : null,
					info: _session.info
						? JSON.parse(JSON.stringify(_session.info)) : null,
				}
			}
		},
	})
	Object.defineProperty(this, 'pendingRequests', {
		get() {
			return _pendingRequests.length
		},
	})
	Object.freeze(this)

	// Autoconnect
	tryAutoconnect(0)
		.then(err => {
			if (err != null) console.error(`WebWire: autoconnect failed:`, err)
		})
		.catch(excep => {
			console.warn(`WebWire: autoconnect failed:`, excep)
		})

	function handleSessionCreated(session) {
		const sessionKey = new SessionKey(session.k)
		_session = {
			key: sessionKey,
			creationDate: new Date(session.c),
			info: session.i,
		}

		// Save session key to local storage for automatic restoration
		const str = JSON.stringify({session: sessionKey.string})
		localStorage.setItem(locStorKey, str)

		// Provide copy of the actual session to preserve its immutability
		_onSessionCreated({
			key: sessionKey,
			creationDate: new Date(session.c),
			info: session.i,
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
			code: message.error.code,
			message: message.error.message,
		})
	}

	function handleReply(message) {
		const req = _pendingRequests[message.id]

		// Ignore unexpected replies
		if (!req) return

		// Fulfill the request
		req.fulfill({
			encoding: message.encoding,
			payload: message.payload,
		})
	}

	async function handleMessage(msgObj) {
		if (msgObj.size < 1) return

		const {
			type,
			msg,
			payloadEncoding,
			err,
		} = await Parse(msgObj)

		if (err != null) {
			console.error(`WebWire: failed parsing message: ${err}`)
			return
		}

		// Handle message
		switch (type) {
		case MessageType.ReplyBinary:
		case MessageType.ReplyUtf8:
		case MessageType.ReplyUtf16:
			handleReply({
				id: msg.id,
				encoding: payloadEncoding,
				payload: msg.payload,
			})
			break
		case MessageType.ReplyShutdown:
		case MessageType.ReplyInternalError:
		case MessageType.SessionNotFound:
		case MessageType.MaxSessConnsReached:
		case MessageType.ErrorReply:
			handleFailure({
				id: msg.id,
				error: msg.reqError,
			})
			break
		case MessageType.SignalBinary:
		case MessageType.SignalUtf8:
		case MessageType.SignalUtf16:
			_onSignal({
				name: msg.name,
				encoding: payloadEncoding,
				payload: msg.payload,
			})
			break
		case MessageType.SessionCreated:
			handleSessionCreated(msg.session)
			break
		case MessageType.SessionClosed:
			handleSessionClosed()
			break
		default:
			console.warn(`WebWire: strange message type received:`, type)
			break
		}
	}

	// verifyProtocolVersion requests the endpoint metadata
	// to verify the server is running a supported protocol version
	async function verifyProtocolVersion() {
		// Initialize HTTP client
		try {
			const getEndpointMetadata = process.browser
				? getEndpointMetadataBrowser : getEndpointMetadataNode
			const {metadata, err} = await getEndpointMetadata(
				_protocol,
				_hostname,
				_port,
				_endpointPath,
			)
			if (err) return err
			const protoVersion = metadata['protocol-version']
			if (protoVersion !== supportedProtocolVersion) {
				const err = new Error(
					`Unsupported protocol version: ${protoVersion} ` +
						`(supported: ${supportedProtocolVersion})`
				)
				err.errType = 'incomp'
				return {err: err}
			}
			return {res: metadata['read-timeout']}
		} catch (excep) {
			return excep
		}
	}

	function sleep(duration) {
		return new Promise(resolve => setTimeout(resolve, duration))
	}

	async function tryAutoconnect(timeoutDur) {
		if (_status === ClientStatus.Connecting) {
			return new Promise((resolve, reject) => {
				_connecting
					.then(resolve)
					.catch(reject)
			})
		} else if (_status !== ClientStatus.Disconnected) {
			return Promise.resolve()
		}
		if (!_autoconnect) return connect()
		return new Promise((resolve, reject) => {
			// Simulate a dam by accumulating awaiting connection attempts
			// and resolving them when connected
			if (_reconnecting != null) {
				if (timeoutDur > 0) {
					setTimeout(() => {
						const err = new Error(`Auto-connect attempt timed out`)
						err.errType = 'timeout'
						resolve(err)
					}, timeoutDur)
				}
				_reconnecting.then(resolve)
				return
			}
			// Resolving the following promise will flush the dam
			_reconnecting = new Promise(async resolve => {
				try {
					if (timeoutDur > 0) {
						setTimeout(() => {
							const err = new Error(
								`Auto-reconnect attempt timed out`
							)
							err.errType = 'timeout'
							resolve(err)
						}, timeoutDur)
						return
					}
					while (1) {
						const err = await connect()
						if (err == null) {
							resolve()
							_reconnecting = null
							return
						} else {
							if (err.errType === 'disconnected') {
								await sleep(_reconnInterval)
								continue
							} else {
								resolve({err})
								_reconnecting = null
								return
							}
						}
					}
				} catch (excep) {
					reject(excep)
				}
			})
		})
	}

	// Sends a request containing the given payload to the server.
	// Returns a promise that is resolved when the server replies.
	// Automatically connects to the server
	// if no connection has yet been established.
	// Optionally takes a timeout, otherwise default timeout is applied
	function sendRequest(
		messageType,
		name,
		payload,
		encoding,
		timeoutDuration,
	) {
		// Connect before attempting to send the request
		return new Promise(async (resolve, reject) => {
			try {
				const reqMsg = messageType && !name
					? new NamelessRequestMessage(messageType, payload)
					: new RequestMessage(name, payload, encoding)
				const reqIdBytes = reqMsg.id.bytes
				const timeoutDur = timeoutDuration || _defaultReqTimeout

				let timeout = setTimeout(() => {
					// Deregister request
					delete _pendingRequests[reqIdBytes]
					timeout = null

					let newErr = new Error(`Request timed out`)
					newErr.errType = 'timeout'
					resolve({err: newErr})
				}, timeoutDur)

				let err = await tryAutoconnect(timeoutDur)
				if (err != null) return resolve({err: err})

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
					},
				}

				// Register request
				_pendingRequests[reqIdBytes] = req

				// Send request
				_conn.send(reqMsg.bytes)

				// Reset heartbeat
				startHeartbeat()
			} catch (excep) {
				reject(excep)
			}
		})
	}

	async function tryRestoreSession(sessionKey) {
		const {reply, err: reqErr} = await sendRequest(
			MessageType.RestoreSession,
			null,
			sessionKey
		)
		if (reqErr != null) {
			// Just log a warning and still return null,
			// even if session restoration failed,
			// because we only care about the connection establishment
			// in this method
			console.warn(`WebWire client: couldn't restore session:`, reqErr)

			// Reset the session
			_session = null
			localStorage.removeItem(locStorKey)
			return reqErr
		}
		const decodedSession = JSON.parse(reply.payload)
		_session = {
			key: new SessionKey(decodedSession.k),
			creationDate: new Date(decodedSession.c),
			info: decodedSession.i,
		}
	}

	function startHeartbeat() {
		clearInterval(_heartbeatTimeout)
		_heartbeatTimeout = setInterval(() => {
			const _buf = new ArrayBuffer(1)
			const msgBuf = new Uint8Array(_buf, 0, 1)
			msgBuf[0] = MessageType.Heartbeat
			try {
				_conn.send(msgBuf)
			} catch(excep) {
				console.error(
					'couldn\'t send heartbeat message: ',
					err,
				)
			}
		}, _readTimeout)
	}

	function stopHeartbeat() {
		clearInterval(_heartbeatTimeout)
		_heartbeatTimeout = null
	}

	// Connects the client to the configured server and
	// returns an error in case of a connection failure
	function connect() {
		if (_status === ClientStatus.Connected) return Promise.resolve()
		else if (_connecting != null) {
			return new Promise((resolve, reject) => {
				_connecting
					.then(resolve)
					.catch(reject)
			})
		}
		_connecting = new Promise(async (resolve, reject) => {
			_status = ClientStatus.Connecting
			try {
				const {res: readTimeout, err} = await verifyProtocolVersion()

				// From seconds to milliseconds, 3/4 before timeout
				_readTimeout = readTimeout * 1000 - (readTimeout * 1000 / 4)

				if (err != null) {
					if (err.errType === 'incomp') throw err
					const disconnErr = new Error('disconnected')
					disconnErr.errType = 'disconnected'
					_connecting = null
					return resolve(disconnErr)
				}

				_conn = new Socket(_websocketEndpointUri)
				_conn.onOpen(async () => {
					_connecting = null
					_status = ClientStatus.Connected

					startHeartbeat()

					if (_session == null) {
						_onConnected()
						return resolve()
					}

					// Try to automatically restore previous session
					const err = await tryRestoreSession(_session.key.bytes)
					if (err != null) {
						console.warn(
							`WebWire: couldn't restore session on reconnection`,
							err,
						)
					}
					_onConnected()
					resolve()
				})
				_conn.onError(err => {
					_connecting = null
					console.error('WebWire client error:', err)
					const connErr = new Error(`WebSocket error: ${err}`)
					connErr.errType = 'disconnected'
					resolve(connErr)
				})
				_conn.onMessage(msg => handleMessage(msg))
				_conn.onClose(async code => {
					_status = ClientStatus.Disconnected
					// See http://tools.ietf.org/html/rfc6455#section-7.4.1
					if (code !== 1000 && code !== 1001) {
						console.warn(
							'WebWire: abnormal closure error: code:',
							code,
						)
					}

					stopHeartbeat()
					_onDisconnected()

					// Auto-reconnect on connection loss
					const err = await tryAutoconnect(0)
					if (err != null) {
						console.error('WebWire: autoconnect failed:', err)
					}
				})
			} catch (excep) {
				reject(excep)
			}
		})
		return _connecting
	}

	// Sends a signal containing the given payload to the server.
	// Automatically connects to the server if no connection has yet been established
	async function signal(name, payload, encoding) {
		const sigMsg = new SignalMessage(name, payload, encoding)

		// Connect before attempting to send the signal
		const err = await connect()
		if (err != null) return err
		_conn.send(sigMsg.bytes)

		// Reset heartbeat
		startHeartbeat()
	}

	// Tries to restore the previously opened session.
	// Fails if a session is currently already active
	// Automatically connects to the server if no connection has yet been established
	async function restoreSession(sessionKey) {
		if (!(sessionKey instanceof SessionKey)) {
			return new Error(
				`Expected session key to be an instance of SessionKey`
			)
		}

		if (_session) {
			return new Error(
				`Can't restore session if another one is already active`
			)
		}
		// Connect before attempting to send the signal
		let connErr = await connect()
		if (connErr != null) return connErr
		const err = await tryRestoreSession(sessionKey.bytes)
		if (err != null) {
			console.warn(
				`WebWire: couldn't restore session by key
					(${sessionKey.string}) : ${err}`
			)
		}
	}

	// Closes the currently active session.
	// Does nothing if there's no active session
	async function closeSession() {
		if (!_session || _status < ClientStatus.Connected) {
			_session = null
			return
		}
		let {err: reqErr} = await sendRequest(MessageType.CloseSession)
		if (reqErr != null) return reqErr
		_session = null
		localStorage.removeItem(locStorKey)
	}

	// Gracefully closes the connection.
	// Does nothing if the client isn't connected
	function close() {
		_conn.close()
		_conn = null
		_status = ClientStatus.Disabled
	}
}
