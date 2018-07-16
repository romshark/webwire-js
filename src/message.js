export const Type = {
	// ErrorReply is sent by the server
	// and represents an error-reply to a previously sent request
	ErrorReply: 0,

	// ReplyShutdown is sent by the server when a request
	// is received during server shutdown and can't therefore be processed
	ReplyShutdown: 1,

	// ReplyInternalError is sent by the server if an unexpected,
	// internal error arose during the processing of a request
	ReplyInternalError: 2,

	// SessionNotFound is sent by the server in response
	// to an unfilfilled session restoration request
	// due to the session not being found
	SessionNotFound: 3,

	// MaxSessConnsReached is sent by the server in response
	// to an authentication request when the maximum number
	// of concurrent connections for a certain session was reached
	MaxSessConnsReached: 4,

	// SessionsDisabled is sent by the server in response
	// to a session restoration request
	// if sessions are disabled for the target server
	SessionsDisabled: 5,

	// ReplyProtocolError is sent by the server in response to an invalid
	// message violating the protocol
	ReplyProtocolError: 6,

	// SERVER

	// SessionCreated is sent by the server
	// to notify the client about the session creation
	SessionCreated: 21,

	// SessionClosed is sent by the server
	// to notify the client about the session destruction
	SessionClosed: 22,

	// CLIENT

	// CloseSession is sent by the client
	// and represents a request for the destruction
	// of the currently active session
	CloseSession: 31,

	// RestoreSession is sent by the client
	// to request session restoration
	RestoreSession: 32,

	// SIGNAL
	// Signals are sent by both the client and the server
	// and represents a one-way signal message that doesn't require a reply

	// SignalBinary represents a signal with binary payload
	SignalBinary: 63,

	// SignalUtf8 represents a signal with UTF8 encoded payload
	SignalUtf8: 64,

	// SignalUtf16 represents a signal with UTF16 encoded payload
	SignalUtf16: 65,

	// REQUEST
	// Requests are sent by the client
	// and represents a roundtrip to the server requiring a reply

	// RequestBinary represents a request with binary payload
	RequestBinary: 127,

	// RequestUtf8 represents a request with a UTF8 encoded payload
	RequestUtf8: 128,

	// RequestUtf16 represents a request with a UTF16 encoded payload
	RequestUtf16: 129,

	// REPLY
	// Replies are sent by the server
	// and represent a reply to a previously sent request

	// ReplyBinary represents a reply with a binary payload
	ReplyBinary: 191,

	// ReplyUtf8 represents a reply with a UTF8 encoded payload
	ReplyUtf8: 192,

	// ReplyUtf16 represents a reply with a UTF16 encoded payload
	ReplyUtf16: 193,
}

export const MinLen = {
	// Signal represents the minimum
	// binary/UTF8 encoded signal message length
	Signal: 3,

	// SignalUtf16 represents the minimum
	// UTF16 encoded signal message length
	SignalUtf16: 4,

	// Request represents the minimum
	// binary/UTF8 encoded request message length
	Request: 11,

	// RequestUtf16 represents the minimum
	// UTF16 encoded request message length
	RequestUtf16: 12,

	// Reply represents the minimum
	// binary/UTF8 encoded reply message length
	Reply: 9,

	// ReplyUtf16 represents the minimum
	// UTF16 encoded reply message length
	ReplyUtf16: 10,

	// ErrorReply represents the minimum error-reply message length
	ErrorReply: 11,

	// ReplyShutdown represents the minimum shutdown-reply message length
	ReplyShutdown: 9,

	// ReplyShutdown represents the minimum
	// internal-error-reply message length
	ReplyInternalError: 9,

	// SessionNotFound represents the minimum
	// session-not-found error message length
	SessionNotFound: 9,

	// MaxSessConnsReached represents the minimum
	// max-session-conns-reached-error message length
	MaxSessConnsReached: 9,

	// SessionsDisabled represents the minimum
	// sessions-disabled-error message length
	SessionsDisabled: 9,

	// ReplyProtocolError represents the minimum protocol-error message length
	ReplyProtocolError: 9,

	// RestoreSession represents the minimum
	// session-restoration-request message length
	RestoreSession: 10,

	// CloseSession represents the minimum
	// session-destruction-request message length
	CloseSession: 9,

	// SessionCreated represents the minimum
	// session-creation-notification message length
	SessionCreated: 2,

	// SessionClosed represents the minimum
	// session-creation-notification message length
	SessionClosed: 1,
}
