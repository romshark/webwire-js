export default {
	SET_API_CONNECTION_STATUS(state, connectionStatus) {
		state.api.connected = connectionStatus
	},
	SET_API_USER(state, user) {
		state.api.user = user
	},
	PUSH_MESSAGE(state, message) {
		state.messages.push({
			author: message.user,
			msg: message.msg,
			time: new Date(),
		})
	},
}
