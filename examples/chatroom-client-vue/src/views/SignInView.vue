<template>
<div class="signin-view">
	<div class="form">
		<h2 class="title">Sign in</h2>

		<input
		class="name"
		type="text"
		placeholder="Gandalf"
		v-model="name"/>

		<input
		class="password"
		type="password"
		placeholder="gandalf1234"
		v-model="password"/>

		<p v-show="errorCode"><b>Authentication Error ({{errorCode}})</b>: {{errorMsg}}</p>

		<button
		:disabled="name == '' || password == ''"
		class="signin-button"
		@click="signin">Sign in</button>
	</div>
</div>
</template>

<script>
import Api from '../api'

export default {
	data() {
		return {
			name: null,
			password: null,
			errorCode: null,
			errorMsg: null
		}
	},
	methods: {
		async signin() {
			let err = await this.$store.dispatch('SIGNIN', {
				name: this.name,
				pass: this.password
			})
			if (err != null) {
				this.errorCode = err.code
				this.errorMsg = err.message
				this.name = ''
				this.password = ''
				return
			}
			this.name = ''
			this.password = ''
			this.$router.push({name: 'MainView'})
		}
	}
}
</script>

<style lang="stylus">
.signin-view
	display: flex
	flex-direction: column
	justify-content: center
	align-items: center
	width: 100%
	height: 100%
	.form
		width: 16rem
		height: 16rem
	.title
		margin: 0px
	.name, .password, .signin-button
		box-sizing: border-box
		margin-top: 1rem
		font-size: 1rem
		padding: .5rem
		background: none
		border: 1px solid #DDD
		border-radius: .2rem
		width: 100%
	.name, .password
		&::-webkit-input-placeholder
			color: #BBB
		&::-moz-placeholder
			color: #BBB
		&:-ms-input-placeholder
			color: #BBB
		&:-moz-placeholder
			color: #BBB
</style>
