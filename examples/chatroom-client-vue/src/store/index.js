import Vue from 'vue'
import Vuex from 'vuex'
import actions from './actions'
import mutations from './mutations'
import getters from './getters'

Vue.use(Vuex)

export function createStore () {
	return new Vuex.Store({
		state: {
			messages: [],
			api: {
				user: null,
				addr: '127.0.0.1:9090',
				connected: false,
			},
		},
		actions,
		mutations,
		getters
	})
}
