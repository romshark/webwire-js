import utf8ArrayToStr from './utf8ArrayToStr'
import {
	Type as MessageType,
	MinLen as MinMsgLen
} from './message'

function parseSessionCreated(message) {
	if (message.length < MinMsgLen.SessionCreated) return {err: new Error(
		`Invalid session creation notification message, ` +
			`too short (${message.length} / ${MinMsgLen.SessionCreated})`
	)}

	return {
		// Read session from payload as UTF8 encoded JSON
		session: JSON.parse(utf8ArrayToStr(message.subarray(1)))
	}
}

function parseSessionClosed(message) {
	if (message.length != MinMsgLen.SessionClosed) return {err: new Error(
		"Invalid session closure notification message"
	)}

	return {}
}

function parseSignalBinary(message) {
	// Minimum binary signal message structure:
	// 1. message type (1 byte)
	// 2. name length flag (1 byte)
	// 3. name (n bytes, required if name length flag is bigger zero)
	// 4. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Signal) return {err: new Error(
		`Invalid signal (Binary) message, too short (${message.length} / ${MinMsgLen.Signal})`
	)}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]
	const payloadOffset = 2 + nameLen

	// Verify total message size to prevent segmentation faults caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond to the actual name length
	if (message.length < MinMsgLen.Signal + nameLen) return {err: new Error(
			`Invalid signal (Binary) message, ` +
				`too short for full name (${nameLen}) and the minimum payload (1)`,
		)
	}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(null, message.subarray(2, payloadOffset)),
			payload: message.subarray(payloadOffset)
		}
	} else {
		// No name present, just payload
		return {
			payload: message.subarray(2)
		}
	}
}

function parseSignalUtf8(message) {
	// Minimum UTF8 signal message structure:
	// 1. message type (1 byte)
	// 2. name length flag (1 byte)
	// 3. name (n bytes, required if name length flag is bigger zero)
	// 4. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Signal) return {err: new Error(
		`Invalid signal (UTF8) message, too short (${message.length} / ${MinMsgLen.Signal})`
	)}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]
	const payloadOffset = 2 + nameLen

	// Verify total message size to prevent segmentation faults caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond to the actual name length
	if (message.length < MinMsgLen.Signal + nameLen) return {err: new Error(
			`Invalid signal (UTF8) message, ` +
				`too short for full name (${nameLen}) and the minimum payload (1)`,
		)
	}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(null, message.subarray(2, payloadOffset)),
			payload: utf8ArrayToStr(message.subarray(payloadOffset))
		}
	} else {
		// No name present, just payload
		return {
			payload: utf8ArrayToStr(message.subarray(2))
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
	if (message.length < MinMsgLen.SignalUtf16) return {err: new Error(
		`Invalid signal (UTF16) message, too short (${message.length} / ${MinMsgLen.SignalUtf16})`
	)}

	if (message.length % 2 != 0) return {err: new Error(
		`Unaligned UTF16 encoded signal message` +
			` (length: ${message.length}, probably missing header padding)`
	)}

	// Read name length
	const nameLen = message.subarray(1, 2)[0]

	// Determine minimum required message length
	const minMsgSize = MinMsgLen.SignalUtf16 + nameLen
	const payloadOffset = 2 + nameLen

	// Check whether a name padding byte is to be expected
	if (nameLen % 2 !== 0) {
		minMsgSize++
		payloadOffset++
	}

	// Verify total message size to prevent segmentation faults caused by inconsistent flags,
	// this could happen if the specified name length doesn't correspond to the actual name length
	if (message.length < minMsgSize) return {err: new Error(
		`Invalid signal (UTF16) message, ` +
			`too short for full name (${nameLen}) and the minimum payload (2)`
	)}

	if (nameLen > 0) {
		// Take name into account
		return {
			name: String.fromCharCode.apply(null, new Uint8Array(message, 2, 2 + nameLen)),

			// Read payload as UTF16 encoded string
			payload: String.fromCharCode.apply(
				null, new Uint16Array(message.subarray(payloadOffset))
			)
		}
	} else {
		// No name present, just payload
		return {
			// Read payload as UTF16 encoded string
			payload: String.fromCharCode.apply(null, new Uint16Array(message.subarray(2)))
		}
	}
}

function parseErrorReply(message) {
	if (message.length < MinMsgLen.ErrorReply) return {err: new Error(
		`Invalid error reply message, too short (${message.length} / ${MinMsgLen.ErrorReply})`
	)}

	const str = utf8ArrayToStr(message.subarray(9))

	return {
		id: message.subarray(1, 9),

		// Read payload as UTF8 encoded JSON
		reqError: JSON.parse(str)
	}
}

function parseReplyShutdown(message) {
	if (message.length < MinMsgLen.ReplyShutdown) return {err: new Error(
		`Invalid shutdown error message, too short (${message.length} / ${MinMsgLen.ReplyShutdown})`
	)}

	const err = new Error("Server is currently being shutdown and won't process the request")
	err.errType = "shutdown"

	return {
		id: message.subarray(1, 9),
		reqError: err
	}
}

function parseInternalError(message) {
	if (message.length < MinMsgLen.ReplyInternalError) return {
		err: new Error(`Invalid internal error message, too short ` +
			`(${message.length} / ${MinMsgLen.ReplyInternalError})`
		)
	}

	const err = new Error("Request failed due to an internal server error")
	err.errType = "internal"

	return {
		id: message.subarray(1, 9),
		reqError: err
	}
}

function parseSessionNotFound(message) {
	if (message.length < MinMsgLen.SessionNotFound) return {
		err: new Error(`Invalid session not found error message, too short ` +
			`(${message.length} / ${MinMsgLen.SessionNotFound})`
		)
	}

	const err = new Error("Requested session wasn't found")
	err.errType = "session_not_found"

	return {
		id: message.subarray(1, 9),
		reqError: err
	}
}

function parseMaxSessConnsReached(message) {
	if (message.length < MinMsgLen.MaxSessConnsReached) return {
		err: new Error(`Invalid max session connections reached error message, too short ` +
			`(${message.length} / ${MinMsgLen.MaxSessConnsReached})`
		)
	}

	// TODO: fix wrong error message
	const err = new Error("Maximum concurrent connections reached for requested session")
	err.errType = "max_sess_conns_reached"

	return {
		id: message.subarray(1, 9),
		reqError: err
	}
}

function parseSessionsDisabled(message) {
	if (message.length < MinMsgLen.SessionsDisabled) return {
		err: new Error(`Invalid sessions disabled message, too short ` +
			`(${message.length} / ${MinMsgLen.SessionsDisabled})`
		)
	}

	const err = new Error("Sessions are disabled for this server")
	err.errType = "sessions_disabled"

	return {
		id: message.subarray(1, 9),
		reqError: err
	}
}

function parseReplyBinary(message) {
	// Minimum UTF8 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Reply) return {err: new Error(
		`Invalid reply (Binary) message, too short (${message.length} / ${MinMsgLen.Reply})`
	)}

	let payload = null
	if (message.length > MinMsgLen.Reply) {
		// Read payload as binary string
		payload = message.subarray(9)
	}

	return {
		id: message.subarray(1, 9),
		payload: payload
	}
}

function parseReplyUtf8(message) {
	// Minimum UTF8 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. payload (n bytes, at least 1 byte)
	if (message.length < MinMsgLen.Reply) return {err: new Error(
		`Invalid reply (UTF8) message, too short (${message.length} / ${MinMsgLen.Reply})`
	)}

	let payload = null
	if (message.length > MinMsgLen.Reply) {
		// Read payload as UTF8 encoded text
		payload = utf8ArrayToStr(message.subarray(9))
	}

	return {
		id: message.subarray(1, 9),
		payload: payload
	}
}

function parseReplyUtf16(message) {
	// Minimum UTF16 reply message structure:
	// 1. message type (1 byte)
	// 2. message id (8 bytes)
	// 3. header padding (1 byte)
	// 4. payload (n bytes, at least 2 bytes)
	if (message.length < MinMsgLen.ReplyUtf16) return {err: new Error(
		`Invalid reply (UTF16) message, too short (${message.length} / ${MinMsgLen.ReplyUtf16})`
	)}

	if (message.length % 2 != 0) return {err: new Error(
		`Unaligned UTF16 encoded reply message` +
			` (length: ${message.length}, probably missing header padding)`
	)}

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
		payload: payload
	}
}

export default function parse(msgObj) {
	return new Promise(resolve => {
		const fileReader = new FileReader()
		fileReader.onload = function() {
			const message = new Uint8Array(this.result)

			if (message.length < 1) return resolve({err: new Error("Invalid message, too short")})
			let payloadEncoding = "binary"

			// Read type
			const msgType = message[0]
			let result

			switch (msgType) {
			case MessageType.SessionCreated:
				result = parseSessionCreated(message)
				break

			case MessageType.SessionClosed:
				result = parseSessionClosed(message)
				break

			case MessageType.SignalBinary:
				result = parseSignalBinary(message)
				break
			case MessageType.SignalUtf8:
				payloadEncoding = "utf8"
				result = parseSignalUtf8(message)
				break
			case MessageType.SignalUtf16:
				payloadEncoding = "utf16"
				result = parseSignalUtf16(message)
				break

			case MessageType.ErrorReply:
				result = parseErrorReply(message)
				break

			case MessageType.ReplyShutdown:
				result = parseReplyShutdown(message)
				break
			case MessageType.ReplyInternalError:
				result = parseInternalError(message)
				break
			case MessageType.SessionNotFound:
				result = parseSessionNotFound(message)
				break
			case MessageType.MaxSessConnsReached:
				result = parseMaxSessConnsReached(message)
				break
			case MessageType.SessionsDisabled:
				result = parseSessionsDisabled(message)
				break

			// Reply message format:
			case MessageType.ReplyBinary:
				result = parseReplyBinary(message)
				break
			case MessageType.ReplyUtf8:
				payloadEncoding = "utf8"
				result = parseReplyUtf8(message)
				break
			case MessageType.ReplyUtf16:
				payloadEncoding = "utf16"
				result = parseReplyUtf16(message)
				break

			// Ignore messages of unsupported message type
			default:
				result = {err: new Error(`Unsupported message type ${msgType}`)}
			}

			if (result.err != null) return resolve({err: result.err})
			else return resolve({
				type: msgType,
				payloadEncoding: payloadEncoding,
				msg: result
			})
		}
		fileReader.readAsArrayBuffer(msgObj)
	})
}
