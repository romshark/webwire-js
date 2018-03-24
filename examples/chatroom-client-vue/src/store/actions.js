import Api from '../api'

export default {
	// CONNECT connects the API client to the API server.
	// Returns an error if anything goes wrong
	async CONNECT({ commit, state }) {
		Api.init(
			state.api.addr,
			{
				// onSignal
				onSignal: signal => {
					commit('PUSH_MESSAGE', JSON.parse(signal.payload))
				},
				onSessionCreated: newSession => {
					commit('SET_API_USER', newSession.info.username)
				},
				onSessionClosed: () => {
					commit('SET_API_USER', null)
				},
				onDisconnected: () => {
					commit('SET_API_CONNECTION_STATUS', false)
				},
				onConnected: () => {
					commit('SET_API_CONNECTION_STATUS', true)
					if (Api.client.session != null) commit(
						'SET_API_USER',
						Api.client.session.info.username
					)
				}
			}
		)
	},

	// SIGNIN tries to authenticate the API client using the provided credentials.
	// Automatically connects the client if no connection has yet been established.
	// Returns an error if anything goes wrong
	async SIGNIN({ dispatch, commit, state }, credentials) {
		if (!state.api.connected) {
			let err = await dispatch("CONNECT")
			if (err != null) return err
		}
		// Send an authentication request with default UTF16 encoding to test whether
		// the server will accept it. Set timeout to 1 second instead of the default 60
		let {err} = await Api.client.request("auth", JSON.stringify(credentials), null, 1000)
		if (err != null) return err
	},

	// SIGNOUT tries to close the currently active API session.
	// Does nothing if there's no currently active session.
	// Returns an error if anything goes wrong
	async SIGNOUT({ commit, state }) {
		if (state.api.user == null) return
		let err = await Api.client.closeSession()
		if (err != null) return err
		commit('SET_API_USER', null)
	},

	// PUSH_MESSAGE pushes a new message to the server in a signal.
	// Returns an error if anything goes wrong
	async PUSH_MESSAGE({ commit, state }, message) {
		if (message.length < 1 || message === '\n') return

		if (!state.api.connected) {
			const err = await dispatch("CONNECT")
			if (err != null) return err
		}
		// UTF8-encode the message in the payload
		// the server doesn't support standard UTF16 JavaScript strings
		const {err} = await Api.client.request("msg", message, "utf8")
		if (err != null) return err
	}
}
