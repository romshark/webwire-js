import Vue from 'vue'
import Router from 'vue-router'

import MainView from '../views/MainView.vue'
import SignInView from '../views/SignInView.vue'

Vue.use(Router)

export function createRouter () {
	return new Router({
		mode: 'history',
		fallback: false,
		scrollBehavior: () => ({y: 0}),
		routes: [{
			path: '/',
			name: 'MainView',
			component: MainView,
		}, {
			path: '/signin',
			name: 'SignInView',
			component: SignInView,
		}],
	})
}
