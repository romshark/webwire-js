const currentId = new Identifier(0, 0)

export function New() {
	currentId.increment()
	const frags = currentId.frags
	return new Identifier(frags.front, frags.end)
}

export function Identifier(front, end) {
	const _buf = new ArrayBuffer(8)
	const _fragments = new Uint32Array(_buf, 0, 2)
	_fragments.set([front, end], 0)

	Object.defineProperty(this, "frags", {
		get: function() {
			return {
				front: _fragments[0],
				end: _fragments[1]
			}
		}
	})


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

export function FromBytes(bytes) {
	if (bytes == null || !(bytes instanceof Uint8Array)) throw new Error(
		`Missing or invalid binary representation of the identifier: ${bytes}`
	)

	let front
	for (let i = 0; i < 4; i++) front *= (bytes[i] + 1)
	let end
	for (let i = 4; i < 9; i++) end *= (bytes[i] + 1)

	return new Identifier(front, end)
}
