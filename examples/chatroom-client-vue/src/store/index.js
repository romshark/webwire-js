import Vue from 'vue'
import Vuex from 'vuex'
import actions from './actions'
import mutations from './mutations'
import getters from './getters'

Vue.use(Vuex)

const apiHost = process.env.API_HOST || '127.0.0.1'
const apiPort = process.env.API_PORT || '9090'

export function createStore () {
	return new Vuex.Store({
		state: {
			messages: [],
			api: {
				user: null,
				host: apiHost,
				port: apiPort,
				connected: false,
			},
		},
		actions,
		mutations,
		getters,
	})
}
