import WebWireClient from '../../../../src'

function init(host, port, handlers) {
	api.client = new WebWireClient(host, port, {handlers})
}

const api = {
	client: null,
	init: init,
}

export default api
