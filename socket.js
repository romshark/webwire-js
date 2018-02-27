function NodeSocket(host) {
	let sock = new WebSocket(host)

	function onOpen(callback) {
		sock.on('open', callback)
	}

	function onError(callback) {}

	function onMessage(callback) {
		sock.on('message', callback)
	}

	function onClose(callback) {
		sock.on('close', callback)
	}

	function send(data) {
		sock.send(data)
	}

	Object.defineProperty(this, 'onOpen', {
		value: onOpen, writable: false,
	})

	Object.defineProperty(this, 'onError', {
		value: onError, writable: false,
	})

	Object.defineProperty(this, 'onMessage', {
		value: onMessage, writable: false,
	})

	Object.defineProperty(this, 'onClose', {
		value: onClose, writable: false,
	})

	Object.defineProperty(this, 'send', {
		value: send, writable: false,
	})
}

function BrowserSocket(host) {
	let sock = new WebSocket(host)

	function onOpen(callback) {
		sock.onopen = callback
	}

	function onError(callback) {
		sock.onerror = callback
	}

	function onMessage(callback) {
		sock.onmessage = event => callback(event.data)
	}

	function onClose(callback) {
		sock.onclose = event => callback(event.code)
	}

	function send(data) {
		sock.send(data)
	}

	Object.defineProperty(this, 'onOpen', {
		value: onOpen, writable: false,
	})

	Object.defineProperty(this, 'onError', {
		value: onError, writable: false,
	})

	Object.defineProperty(this, 'onMessage', {
		value: onMessage, writable: false,
	})

	Object.defineProperty(this, 'onClose', {
		value: onClose, writable: false,
	})

	Object.defineProperty(this, 'send', {
		value: send, writable: false,
	})
}

if (process.browser) module.exports = BrowserSocket
else module.exports = NodeSocket
