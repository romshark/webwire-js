import {
	Type as MessageType
} from './message'
import {
	New as NewIdentifier,
	Identifier as RequestIdentifier
} from './identifier'

// RequestMessage represents an instantiatable webwire request message
// name is optional and must be shorter 255 and must contain only ASCII characters (range 32-126)
// if the payload is a string the encoding is undefined then the payload will be encoded in UTF16
export default function RequestMessage(name, payload, encoding) {
	if (payload == null) throw new Error("Missing request payload")
	if (name == null) name = ''
	if (name.length > 255) throw new Error(`Request name too long (${name.length}), max 255`)

	let _buf
	const id = NewIdentifier()

	// Encode string into UTF8 payload
	if (typeof payload === 'string' && encoding === "utf8") {
		const encodedPayload = StrToUtf8Array(payload)

		// Decide padding byte for unaligned header (offset of payload must be power 2)
		let headerPadding = false
		if (name != null && name.length % 2 !== 0) headerPadding = true

		// Determine total message size
		const headerSize = 10 + name.length + (headerPadding ? 1 : 0)
		_buf = new ArrayBuffer(headerSize + encodedPayload.length)
		const headerBuf = new Uint8Array(_buf, 0, headerSize)

		// Write type flag, default to RequestUtf8
		headerBuf[0] = MessageType.RequestUtf8

		// Write identifier
		const idBytes = id.bytes
		for (let i = 1; i < 9; i++) {
			headerBuf[i] = idBytes[i - 1]
		}

		// Write name length flag
		headerBuf[9] = name.length

		// Write name
		for (let i = 0; i < name.length; i++) {
			let charCode = name.charCodeAt(i)
			if (charCode < 32 || charCode > 126) throw new Error(
				`Unsupported name character (${charCode})`
			)
			headerBuf[10 + i] = name.charCodeAt(i)
		}

		// Write payload at an offset equal to the header size (which includes the padding)
		const payloadBuf = new Uint8Array(_buf, headerSize, payload.length)
		for (let i = 0; i < payload.length; i++) {
			payloadBuf[i] = payload.charCodeAt(i)
		}
	}
	// Encode string into UTF16 payload
	else if (typeof payload === 'string' && encoding == null) {
		// Decide padding byte for unaligned header (offset of payload must be power 2)
		let headerPadding = false
		if (name != null && name.length % 2 !== 0) headerPadding = true

		// Determine total message size
		const headerSize = 10 + name.length + (headerPadding ? 1 : 0)
		_buf = new ArrayBuffer(headerSize + payload.length * 2)
		const headerBuf = new Uint8Array(_buf, 0, headerSize)

		// Write type flag, default to RequestUtf16
		headerBuf[0] = MessageType.RequestUtf16

		// Write identifier
		const idBytes = id.bytes
		for (let i = 1; i < 9; i++) {
			headerBuf[i] = idBytes[i - 1]
		}

		// Write name length flag
		headerBuf[9] = name.length

		// Write name
		for (let i = 0; i < name.length; i++) {
			let charCode = name.charCodeAt(i)
			if (charCode < 32 || charCode > 126) throw new Error(
				`Unsupported name character (${charCode})`
			)
			headerBuf[10 + i] = name.charCodeAt(i)
		}

		// Write payload at an offset equal to the header size (which includes the padding)
		const payloadBuf = new Uint16Array(_buf, headerSize, payload.length)
		for (let i = 0; i < payload.length; i++) {
			payloadBuf[i] = payload.charCodeAt(i)
		}
	}
	else throw new Error("Unsupported request payload type: " + (typeof payload))

	Object.defineProperty(this, "bytes", {
		get: function() {
			return new Uint8Array(_buf)
		}
	})

	Object.defineProperty(this, "id", {
		get: function() {
			return id
		}
	})
}
