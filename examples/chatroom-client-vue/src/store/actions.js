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
					commit('PUSH_MESSAGE', JSON.parse(signal))
				}
			}
		)
		let err = await Api.client.connect()
		if (err != null) {
			err.message = 'Failed connecting: ' + err.message
			return err
		}
		commit('SET_API_CONNECTION_STATUS', true)
	},

	// SIGNIN tries to authenticate the API client using the provided credentials.
	// Automatically connects the client if no connection has yet been established.
	// Returns an error if anything goes wrong
	async SIGNIN({ dispatch, commit, state }, credentials) {
		if (!state.api.connected) {
			let err = await dispatch("CONNECT")
			if (err != null) return err
		}
		let {err} = await Api.client.request(JSON.stringify(credentials))
		if (err != null) return err

		commit('SET_API_AUTH_STATUS', true)
	},

	// SIGNOUT tries to close the currently active API session.
	// Does nothing if there's no currently active session.
	// Returns an error if anything goes wrong
	async SIGNOUT({ commit, state }) {
		if (!state.api.authenticated) return
		let err = await Api.client.closeSession()
		if (err != null) return err
		commit('SET_API_AUTH_STATUS', false)
	},

	// PUSH_MESSAGE pushes a new message to the server in a signal.
	// Returns an error if anything goes wrong
	async PUSH_MESSAGE({ commit, state }, message) {
		if (message.length < 1 || message === '\n') return

		if (!state.api.connected) {
			let err = await dispatch("CONNECT")
			if (err != null) return err
		}
		let err = await Api.client.signal(message)
		if (err != null) return err
	}
}
