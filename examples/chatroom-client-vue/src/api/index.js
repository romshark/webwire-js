import WebWireClient from '../../../../index.js'

const logEvents = !!process.env.DEBUG_API

function init(serverAddr, callbacks) {
	api.client = new WebWireClient(serverAddr, callbacks)
}

const api = {
	client: null,
	init: init
}

export default api