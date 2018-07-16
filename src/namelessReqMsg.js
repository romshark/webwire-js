import {
	New as NewIdentifier,
} from './identifier'

// NamelessRequestMessage represents a nameless, instantiatable
// webwire request message.
// payload must be a binary Uint8Array
export default function NamelessRequestMessage(type, payload) {
	if (type == null || type < 0 || type > 255) {
		throw new Error(`Missing or invalid message type ${type}`)
	}
	if (payload != null && !(payload instanceof Uint8Array)) {
		throw new Error(`Invalid request payload: ${typeof payload}`)
	}

	// Determine total message size
	const payloadSize = payload != null ? payload.length : 0
	const _buf = new ArrayBuffer(9 + payloadSize)
	const writeBuf = new Uint8Array(_buf, 0, 9 + payloadSize)

	// Write type flag, default to RequestUtf8
	writeBuf[0] = type

	// Write identifier
	const id = NewIdentifier()
	const idBytes = id.bytes
	for (let i = 1; i < 9; i++) writeBuf[i] = idBytes[i - 1]

	// Write payload if any
	if (payload != null) {
		for (let i = 0; i < payloadSize; i++) writeBuf[9 + i] = payload[i]
	}

	Object.defineProperty(this, 'bytes', {
		get: function() {
			return new Uint8Array(_buf)
		},
	})

	Object.defineProperty(this, 'id', {
		get: function() {
			return id
		},
	})
}
