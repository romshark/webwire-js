function onNode(host) {
	const http = require('http')
	return new Promise((resolve, reject) => {
		try {
			const req = http.request({
				host,
				method: 'WEBWIRE',
				json: true,
			}, (res) => {
				if (res.statusCode !== 200) {
					const disconnErr = new Error(
						`Unexpected response status: ${res.statusCode}`
					)
					disconnErr.errType = 'disconnected'
					resolve({err: disconnErr})
					return
				}
				let data = ''
				res.on('data', chunk => {
					data += chunk
				})
				res.on('end', function() {
					resolve({metadata: JSON.parse(data)})
				})
			})
			req.on('error', err => {
				const disconnErr = new Error(
					`Failed reading endpoint metadata: ${err.message}`
				)
				disconnErr.errType = 'disconnected'
				resolve({err: disconnErr})
			})
			req.end()
		} catch (excep) {
			reject(excep)
		}
	})
}

function onBrowser(host) {
	return new Promise((resolve, reject) => {
		try {
			const req = new XMLHttpRequest()
			req.open('WEBWIRE', `http://${host}`, true)
			req.onload = function() {
				if (req.readyState !== 4) {
					const disconnErr = new Error(
						`Unexpected ready state: ${req.readyState}`
					)
					disconnErr.errType = 'disconnected'
					resolve({err: disconnErr})
					return
				} else if (req.status !== 200) {
					const disconnErr = new Error(
						`Unexpected response status: ${req.status}`
					)
					disconnErr.errType = 'disconnected'
					resolve({err: disconnErr})
					return
				}
				resolve({metadata: JSON.parse(req.responseText)})
			}
			req.onerror = function() {
				const disconnErr = new Error(`Unexpected error`)
				disconnErr.errType = 'disconnected'
				resolve({err: disconnErr})
			}
			req.send()
		} catch (excep) {
			reject(excep)
		}
	})
}

if (process.browser) module.exports = onBrowser
else module.exports = onNode
