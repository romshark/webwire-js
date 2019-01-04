
const supportedProtocolVersion = 2

// verifyProtocolVersion returns an error if the given protovol version
// isn't compatible with this version of the client, otherwise returns null
export default function verifyProtocolVersion(major, minor) {
	// Initialize HTTP client
	if (major !== supportedProtocolVersion) {
		const err = new Error(
			`Unsupported protocol version: ${major}.${minor} ` +
				`(supported: ${supportedProtocolVersion}.0)`
		)
		err.errType = 'incompatibleProtocolVersion'
		return err
	}
}
