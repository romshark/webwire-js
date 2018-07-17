// eslint-disable-next-line max-len
const regexp = /^((http|https):\/\/)?(localhost|((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){3}((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))|(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]))(:([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?\/*(\/([^/]+)\/?.*$)?$/

function fromString(hostAddress) {
	const parsed = regexp.exec(hostAddress)

	if (parsed == null) {
		throw new Error(`Invalid server host string: ${hostAddress}`)
	}

	const protocol = parsed[2] || 'http'
	const hostname = parsed[3]
	let port = parseInt(parsed[13] || 80)
	const path = parsed[14]

	if (protocol === 'https' && parsed[13] == null) port = 443

	return {
		protocol,
		hostname,
		port,
		path,
	}
}

export default function(hostAddress) {
	if (typeof hostAddress !== 'string' || hostAddress.length < 1) {
		throw new Error(`Invalid WebWire server host`)
	}
	return fromString(hostAddress)
}
