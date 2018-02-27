import Vue from 'vue'

export default {
	SET_API_CONNECTION_STATUS(state, connectionStatus) {
		state.api.connected = connectionStatus
	},
	SET_API_AUTH_STATUS(state, authenticationStatus) {
		state.api.authenticated = authenticationStatus
	},
	PUSH_MESSAGE(state, message) {
		state.messages.push({
			author: message.user,
			msg: message.msg,
			time: new Date()
		})
	}
}
