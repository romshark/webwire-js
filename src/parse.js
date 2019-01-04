import utf8ArrayToStr from './utf8ArrayToStr'
import asciiArrayToStr from './asciiArrayToStr'
import {
	Type as MessageType,
	MinLen as MinMsgLen,
} from './message'

export default parse

function parseSessionCreated(message) {
	if (message.length < MinMsgLen.SessionCreated) {
		return {err: new Error(
			`Invalid session creation notification message, ` +
				`too short (${message.length} / ${MinMsgLen.SessionCreated})`
		)}
	}

	return {
		// Read session from payload as UTF8 encoded JSON
		session: JSON.parse(utf8ArrayToStr(message.subarray(1))),
	}
}

function parseSessionClosed(message) {
	if (message.length !== MinMsgLen.SessionClosed) {
		return {err: new Error(`Invalid session closure notification message`)}
	}

	return {}
}

function parseSignalBinary(message) {
	// Minimum binary signal message structure:
	// 1. message type (1 byte)
	// 2. name length flag (1 byte)
	// 3. name (n bytes, required if name length flag is bigger zero)
	// 4. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Signal) {
		return {err: new Error(
			`Invalid signal (Binary) message, too short ` +
				`(${message.length} / ${MinMsgLen.Signal})`
		)}
	}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]
	const payloadOffset = 2 + nameLen

	// Verify total message size to prevent segmentation faults
	// caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond
	// to the actual name length
	if (message.length < MinMsgLen.Signal + nameLen) {
		return {err: new Error(
			`Invalid signal (Binary) message, ` +
				`too short for full name` +
				`(${nameLen}) and the minimum payload (1)`,
		)}
	}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(
				null,
				message.subarray(2, payloadOffset)
			),
			payload: message.subarray(payloadOffset),
		}
	} else {
		// No name present, just payload
		return {
			payload: message.subarray(2),
		}
	}
}

function parseSignalUtf8(message) {
	// Minimum UTF8 signal message structure:
	// 1. message type (1 byte)
	// 2. name length flag (1 byte)
	// 3. name (n bytes, required if name length flag is bigger zero)
	// 4. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Signal) {
		return {err: new Error(
			`Invalid signal (UTF8) message, too short ` +
				`(${message.length} / ${MinMsgLen.Signal})`
		)}
	}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]
	const payloadOffset = 2 + nameLen

	// Verify total message size to prevent segmentation faults
	// caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond
	// to the actual name length
	if (message.length < MinMsgLen.Signal + nameLen) {
		return {err: new Error(
			`Invalid signal (UTF8) message, ` +
				`too short for full name (${nameLen}) ` +
				`and the minimum payload (1)`,
		)}
	}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(
				null,
				message.subarray(2, payloadOffset)
			),
			payload: utf8ArrayToStr(message.subarray(payloadOffset)),
		}
	} else {
		// No name present, just payload
		return {
			payload: utf8ArrayToStr(message.subarray(2)),
		}
	}
}

function parseSignalUtf16(message) {
	// Minimum UTF16 signal message structure:
	// 1. message type (1 byte)
	// 2. name length flag (1 byte)
	// 3. name (n bytes, required if name length flag is bigger zero)
	// 4. header padding (1 byte, present if name length is odd)
	// 5. payload (n bytes, at least 2 bytes)
	if (message.length < MinMsgLen.SignalUtf16) {
		return {err: new Error(
			`Invalid signal (UTF16) message, too short ` +
				`(${message.length} / ${MinMsgLen.SignalUtf16})`
		)}
	}

	if (message.length % 2 !== 0) {
		return {err: new Error(
			`Unaligned UTF16 encoded signal message ` +
				`(length: ${message.length}, probably missing header padding)`
		)}
	}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]

	// Determine minimum required message length
	let minMsgSize = MinMsgLen.SignalUtf16 + nameLen
	let payloadOffset = 2 + nameLen

	// Check whether a name padding byte is to be expected
	if (nameLen % 2 !== 0) {
		minMsgSize++
		payloadOffset++
	}

	// Verify total message size to prevent segmentation faults
	// caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond
	// to the actual name length
	if (message.length < minMsgSize) {
		return {err: new Error(
			`Invalid signal (UTF16) message, ` +
				`too short for full name ` +
				`(${nameLen}) and the minimum payload (2)`
		)}
	}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(
				null,
				new Uint8Array(message, 2, 2 + nameLen)
			),

			// Read payload as UTF16 encoded string
			payload: String.fromCharCode.apply(
				null,
				new Uint16Array(message.subarray(payloadOffset)),
			),
		}
	} else {
		// No name present, just payload
		return {
			// Read payload as UTF16 encoded string
			payload: String.fromCharCode.apply(
				null,
				new Uint16Array(message.subarray(2)),
			),
		}
	}
}

function parseErrorReply(message) {
	if (message.length < MinMsgLen.ErrorReply) {
		return {err: new Error(
			`Invalid error reply message, too short ` +
				`(${message.length} / ${MinMsgLen.ErrorReply})`
		)}
	}

	// Read error code length
	const errCodeLen = message.subarray(9, 10)[0]

	if (errCodeLen < 1) {
		return {err: new Error(
			`Invalid error code length in error reply message`
		)}
	}

	// Verify total message size to prevent segmentation faults
	// caused by inconsistent flags, this could happen if the specified
	// error code length doesn't correspond to the actual length.
	// Subtract 1 character already taken into account by MinMsgLen.ErrorReply
	if (message.length < MinMsgLen.ErrorReply + errCodeLen - 1) {
		return {err: new Error(
			`Invalid error reply message, ` +
				`too short for error code (${errCodeLen})`
		)}
	}

	// Read UTF8 encoded error message
	const err = new Error(utf8ArrayToStr(message.subarray(10 + errCodeLen)))

	// Read ASCII 7 bit encoded error code
	err.code = asciiArrayToStr(message.subarray(10, 10 + errCodeLen))

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseReplyShutdown(message) {
	if (message.length < MinMsgLen.ReplyShutdown) {
		return {err: new Error(
			`Invalid shutdown error message, too short ` +
				`(${message.length} / ${MinMsgLen.ReplyShutdown})`
		)}
	}

	const err = new Error(
		`Server is currently being shutdown and won't process the request`
	)
	err.errType = 'shutdown'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseInternalError(message) {
	if (message.length < MinMsgLen.ReplyInternalError) {
		return {err: new Error(
			`Invalid internal error message, too short ` +
				`(${message.length} / ${MinMsgLen.ReplyInternalError})`
		)}
	}

	const err = new Error(`Request failed due to an internal server error`)
	err.errType = 'internal'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseProtocolError(message) {
	if (message.length < MinMsgLen.ReplyProtocolError) {
		return {err: new Error(
			`Invalid protocol error reply message, too short: ` +
				`(${message.length} / ${MinMsgLen.ReplyProtocolError})`
		)}
	}

	const err = new Error(`Protocol error`)
	err.errType = 'protocol_error'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseSessionNotFound(message) {
	if (message.length < MinMsgLen.SessionNotFound) {
		return {err: new Error(
			`Invalid session not found error message, too short ` +
				`(${message.length} / ${MinMsgLen.SessionNotFound})`
		)}
	}

	const err = new Error(`Requested session wasn't found`)
	err.errType = 'session_not_found'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseMaxSessConnsReached(message) {
	if (message.length < MinMsgLen.MaxSessConnsReached) {
		return {err: new Error(
			`Invalid max-session-connections-reached error message, ` +
				`too short ` +
				`(${message.length} / ${MinMsgLen.MaxSessConnsReached})`
		)}
	}

	// TODO: fix wrong error message
	const err = new Error(
		`Maximum concurrent connections reached for requested session`
	)
	err.errType = 'max_sess_conns_reached'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseSessionsDisabled(message) {
	if (message.length < MinMsgLen.SessionsDisabled) {
		return {err: new Error(
			`Invalid sessions disabled message, too short ` +
				`(${message.length} / ${MinMsgLen.SessionsDisabled})`
		)}
	}

	const err = new Error(`Sessions are disabled for this server`)
	err.errType = 'sessions_disabled'

	return {
		id: message.subarray(1, 9),
		reqError: err,
	}
}

function parseReplyBinary(message) {
	// Minimum UTF8 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Reply) {
		return {err: new Error(
			`Invalid reply (Binary) message, too short ` +
				`(${message.length} / ${MinMsgLen.Reply})`
		)}
	}

	let payload = null
	if (message.length > MinMsgLen.Reply) {
		// Read payload as binary string
		payload = message.subarray(9)
	}

	return {
		id: message.subarray(1, 9),
		payload: payload,
	}
}

function parseReplyUtf8(message) {
	// Minimum UTF8 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Reply) {
		return {err: new Error(
			`Invalid reply (UTF8) message, too short ` +
				`(${message.length} / ${MinMsgLen.Reply})`
		)}
	}

	let payload = null
	if (message.length > MinMsgLen.Reply) {
		// Read payload as UTF8 encoded text
		payload = utf8ArrayToStr(message.subarray(9))
	}

	return {
		id: message.subarray(1, 9),
		payload: payload,
	}
}

function parseReplyUtf16(message) {
	// Minimum UTF16 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. header padding (1 byte)
	// 4. payload (n bytes, at least 2 bytes)
	if (message.length < MinMsgLen.ReplyUtf16) {
		return {err: new Error(
			`Invalid reply (UTF16) message, too short ` +
				`(${message.length} / ${MinMsgLen.ReplyUtf16})`
		)}
	}

	if (message.length % 2 !== 0) {
		return {err: new Error(
			`Unaligned UTF16 encoded reply message ` +
				`(length: ${message.length}, probably missing header padding)`
		)}
	}

	let payload = null
	if (message.length > MinMsgLen.ReplyUtf16) {
		// Read payload as UTF16 encoded text
		payload = String.fromCharCode.apply(
			null, new Uint16Array(message, 10, message.length - 10 / 2)
		)
	}

	return {
		id: message.subarray(1, 9),

		// Read payload as UTF8 encoded string
		payload: payload,
	}
}

function parseAcceptConf(buffer, view8) {
	if (view8.length < MinMsgLen.AcceptConf) {
		return {err: new Error(`Invalid accept-conf message, too short` +
			`(${view8.length} / ${MinMsgLen.ReplyUtf16})`
		)}
	}

	const view = new DataView(buffer)

	return {
		majorProtocolVersion: view8[1],
		minorProtocolVersion: view8[2],
		readTimeout: view.getUint32(3, true),
		messageBufferSize: view.getUint32(7, true),
		subProtocolName: view8.length > MinMsgLen.AcceptConf ?
			utf8ArrayToStr(view8.subarray(11)) : null
	}
}

function parseMsg(buffer, view8) {
	if (view8.length < 1) {
		return {err: new Error(`Invalid message, too short`)}
	}
	let payloadEncoding = 'binary'

	// Read type
	const msgType = view8[0]
	let result

	switch (msgType) {
	// Accept-conf
	case MessageType.AcceptConf:
		result = parseAcceptConf(buffer, view8)
		break

	// Special notifications
	case MessageType.SessionCreated:
		result = parseSessionCreated(view8)
		break
	case MessageType.SessionClosed:
		result = parseSessionClosed(view8)
		break

	// Signals
	case MessageType.SignalBinary:
		result = parseSignalBinary(view8)
		break
	case MessageType.SignalUtf8:
		payloadEncoding = 'utf8'
		result = parseSignalUtf8(view8)
		break
	case MessageType.SignalUtf16:
		payloadEncoding = 'utf16'
		result = parseSignalUtf16(view8)
		break

	// Special request replies
	case MessageType.ReplyShutdown:
		result = parseReplyShutdown(view8)
		break
	case MessageType.ReplyInternalError:
		result = parseInternalError(view8)
		break
	case MessageType.SessionNotFound:
		result = parseSessionNotFound(view8)
		break
	case MessageType.MaxSessConnsReached:
		result = parseMaxSessConnsReached(view8)
		break
	case MessageType.SessionsDisabled:
		result = parseSessionsDisabled(view8)
		break
	case MessageType.ErrorReply:
		result = parseErrorReply(view8)
		break
	case MessageType.ReplyProtocolError:
		result = parseProtocolError(view8)
		break

	// Request replies
	case MessageType.ReplyBinary:
		result = parseReplyBinary(view8)
		break
	case MessageType.ReplyUtf8:
		payloadEncoding = 'utf8'
		result = parseReplyUtf8(view8)
		break
	case MessageType.ReplyUtf16:
		payloadEncoding = 'utf16'
		result = parseReplyUtf16(view8)
		break

	// Ignore messages of unsupported message type
	default:
		result = {err: new Error(`Unsupported message type: ${msgType}`)}
	}

	if (result.err != null) return {err: result.err}
	else {
		return {
			type: msgType,
			payloadEncoding: payloadEncoding,
			msg: result,
		}
	}
}

function parse(msg) {
	return new Promise((resolve, reject) => {
		try {
			if (process.browser) {
				const reader = new FileReader()
				reader.onerror = function(event) {
					reject(event.target.error)
				}
				reader.onload = function() {
					resolve(parseMsg(
						this.result,
						new Uint8Array(this.result)
					))
				}
				reader.readAsArrayBuffer(msg)
			} else {
				resolve(parseMsg(msg.buffer, new Uint8Array(
					msg.buffer,
					msg.byteOffset,
					msg.byteLength / Uint8Array.BYTES_PER_ELEMENT
				)))
			}
		} catch (excep) {
			reject(excep)
		}
	})
}
