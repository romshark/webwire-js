import WebWireClient from '../../../../index.js'

const logEvents = !!process.env.DEBUG_API

function init(serverAddr, handlers) {
	api.client = new WebWireClient(serverAddr, { handlers })
}

const api = {
	client: null,
	init: init
}

export default api