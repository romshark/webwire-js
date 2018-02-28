export function Identifier() {
	const _buf = new ArrayBuffer(8)
	const _fragments = new Uint32Array(_buf, 0, 2)

	Object.defineProperty(this, "bytes", {
		get: function() {
			// Endianess doesn't matter since what are only interested in the uniqueness
			// of the identifier in the context of the creator to differentiate messages
			return new Uint8Array(_buf)
		}
	})

	Object.defineProperty(this, "increment", {
		value: function() {
			let front = _fragments[0]
			let end = _fragments[1]

			if (end + 1 > 4294967295) {
				if (front + 1 > 4294967295) {
					// Overflow!
					end = 0
					front = 0
				}
				end = 0
				front++
			} else {
				end++
			}

			_fragments.set([front, end], 0)
		}
	})
}

// name is optional and must be shorter 255 and must contain only ASCII characters (range 32-126)
export function RequestMessage(type, id, name, payload) {
	let _buf

	if (id == null) throw new Error('Missing request identifier')
	if (payload == null) throw new Error("Missing request payload")
	if (name == null) name = ''

	if (typeof payload === 'string') {
		// Decide padding byte for unaligned name (offset of payload must be power 2)
		let namePaddingByte = false
		if (name != null && name.length % 2 !== 0) namePaddingByte = true

		// Construct from string
		const headerSize = 10 + name.length + (namePaddingByte ? 1 : 0)
		_buf = new ArrayBuffer(headerSize + payload.length * 2)

		// Write type flag, default to 129 (RequestUtf16)
		const headerBuf = new Uint8Array(_buf, 0, headerSize)
		headerBuf[0] = type != null ? type : 129

		// Write request identifier
		const idBytes = id.bytes
		for (let i = 1; i < 9; i++) {
			headerBuf[i] = idBytes[i - 1]
		}

		// Write name length flag
		headerBuf[9] = name.length

		// Write request name
		for (let i = 0; i < name.length; i++) {
			let charCode = name.charCodeAt(i)
			if (charCode < 32 || charCode > 126) throw new Error(
				`Unsupported name character (${charCode})`
			)
			headerBuf[10 + i] = name.charCodeAt(i)
		}

		// Write request payload
		var payloadBuf = new Uint16Array(_buf, headerSize, payload.length)
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
}

// name is optional and must be shorter 255 and must contain only ASCII characters (range 32-126)
export function SignalMessage(name, payload) {
	let _buf

	if (name == null) name = ''
	if (payload == null) throw new Error("Missing signal payload")

	if (typeof payload === 'string') {
		// Decide padding byte for unaligned name (offset of payload must be power 2)
		let namePaddingByte = false
		if (name.length % 2 !== 0) namePaddingByte = true

		// Construct from string
		const headerSize = 2 + name.length + (namePaddingByte ? 1 : 0)
		_buf = new ArrayBuffer(headerSize + payload.length * 2)

		// Write type flag
		const headerBuf = new Uint8Array(_buf, 0, headerSize)
		headerBuf[0] = 113

		// Write name length flag
		headerBuf[1] = name.length

		// Write request name
		for (let i = 0; i < name.length; i++) {
			headerBuf[2 + i] = name.charCodeAt(i)
		}

		// Write request payload
		var payloadBuf = new Uint16Array(_buf, headerSize, payload.length)
		for (let i = 0; i < payload.length; i++) {
			payloadBuf[i] = payload.charCodeAt(i)
		}
	}
	else throw new Error("Unsupported signal payload type: " + (typeof payload))

	Object.defineProperty(this, "bytes", {
		get: function() {
			return new Uint8Array(_buf)
		}
	})
}
