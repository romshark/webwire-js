import WebWireClient from '../../../../src'

function init(host, handlers) {
	api.client = new WebWireClient(host, {handlers})
}

const api = {
	client: null,
	init: init,
}

export default api
