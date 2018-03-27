import WebWireClient from '../../../../lib/webwire'

const logEvents = !!process.env.DEBUG_API

function init(host, port, handlers) {
	api.client = new WebWireClient(host, port, { handlers })
}

const api = {
	client: null,
	init: init
}

export default api