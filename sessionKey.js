// SessionKey represents a valid session key in binary representation
export default function SessionKey(str) {
	let _buf

	// Determine total message size
	_buf = new ArrayBuffer(str.length)

	// Write
	const bytes = new Uint8Array(_buf)
	for (let i = 0; i < str.length; i++) {
		let charCode = str.charCodeAt(i)
		if (charCode < 32 || charCode > 126) throw new Error(
			`Unsupported session key character (${charCode})`
		)
		bytes[i] = charCode
	}

	Object.defineProperty(this, "bytes", {
		get: function() {
			return bytes
		}
	})
}
