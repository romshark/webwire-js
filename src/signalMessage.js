import {
	Type as MessageType,
} from './message'
import strToUtf8Array from './strToUtf8Array'

// SignalMessage represents an instantiatable webwire signal message
// name is optional and must be shorter 255
// and must contain only ASCII characters (range 32-126)
export default function SignalMessage(name, payload, encoding) {
	if (name == null) name = ''
	if (payload == null) throw new Error(`Missing signal payload`)

	let _buf

	if (typeof payload === 'string' && encoding === 'utf8') {
		// Encode string to UTF8 payload

		const encodedPayload = strToUtf8Array(payload)

		// Determine total message size
		const headerSize = 2 + name.length
		_buf = new ArrayBuffer(headerSize + encodedPayload.length)
		const headerBuf = new Uint8Array(_buf, 0, headerSize)

		// Write type flag
		// JavaScript strings are always UTF8 encoded
		// thus the payload must be UTF8 too
		headerBuf[0] = MessageType.SignalUtf8

		// Write name length flag
		headerBuf[1] = name.length

		// Write name
		for (let i = 0; i < name.length; i++) {
			headerBuf[2 + i] = name.charCodeAt(i)
		}

		// Write payload at an offset equal to the header size
		// (which includes the padding)
		const payloadBuf = new Uint8Array(
			_buf,
			headerSize,
			encodedPayload.length,
		)
		for (let i = 0; i < encodedPayload.length; i++) {
			payloadBuf[i] = encodedPayload[i]
		}
	} else if (typeof payload === 'string' && encoding == null) {
		// Encode string into UTF16 payload

		// Decide padding byte for unaligned header
		// (offset of payload must be power 2)
		let headerPadding = false
		if (name.length % 2 !== 0) headerPadding = true

		// Determine total message size
		const headerSize = 2 + name.length + (headerPadding ? 1 : 0)
		_buf = new ArrayBuffer(headerSize + payload.length * 2)
		const headerBuf = new Uint8Array(_buf, 0, headerSize)

		// Write type flag
		// JavaScript strings are always UTF16 encoded
		// thus the payload must be UTF16 too
		headerBuf[0] = MessageType.SignalUtf16

		// Write name length flag
		headerBuf[1] = name.length

		// Write name
		for (let i = 0; i < name.length; i++) {
			headerBuf[2 + i] = name.charCodeAt(i)
		}

		// Write payload at an offset equal to the header size
		// (which includes the padding)
		const payloadBuf = new Uint16Array(_buf, headerSize, payload.length)
		for (let i = 0; i < payload.length; i++) {
			payloadBuf[i] = payload.charCodeAt(i)
		}
	} else {
		throw new Error(`Unsupported signal payload type: ${(typeof payload)}`)
	}

	Object.defineProperty(this, 'bytes', {
		get: function() {
			return new Uint8Array(_buf)
		},
	})
}
