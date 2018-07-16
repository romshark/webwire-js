// SessionKey represents a valid session key in binary representation
export default function SessionKey(_str) {
	let _buf

	// Determine total message size
	_buf = new ArrayBuffer(_str.length)

	// Write
	const bytes = new Uint8Array(_buf)
	for (let i = 0; i < _str.length; i++) {
		let charCode = _str.charCodeAt(i)
		if (charCode < 32 || charCode > 126) {
			throw new Error(`Unsupported session key character (${charCode})`)
		}
		bytes[i] = charCode
	}

	Object.defineProperty(this, 'bytes', {
		get: function() {
			return bytes
		},
	})

	Object.defineProperty(this, 'string', {
		get: function() {
			return _str
		},
	})
}
