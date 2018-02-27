<template>
<div class="main-view">
	<div
	class="connect-screen"
	v-if="!$store.state.api.connected">
		<p>Connecting...</p>
		<p class="server">{{$store.state.api.addr}}</p>
	</div>

	<div class="header">
		<h1 class="page-title">WebWire Vue ChatRoom</h1>
		<router-link
		:to="{name: 'SignInView'}"
		class="signin-button"
		v-if="!$store.state.api.authenticated">
			Sign In
		</router-link>
		<button
		v-if="$store.state.api.authenticated"
		class="signout-button"
		@click="signout">
			Sign Out
		</button>
	</div>
	<ul class="message-list">
		<li
		v-for="(message, id) in $store.state.messages"
		:key="id"
		class="message">
			<div class="message-header">
				<span class="message-author">{{message.author}}</span>
				<span class="message-time">{{message.time.toLocaleString()}}</span>
			</div>
			<span class="message-text">{{message.msg}}</span>
		</li>
	</ul>
	<textarea
	class="message-input"
	rows="4"
	v-model="newMessage"
	@keyup.13="sendMessage"></textarea>
	<p v-show="sendError"><b>Sending Error</b> {{sendError}}</p>
</div>
</template>

<script>
export default {
	data() {
		return {
			newMessage: '',
			sendError: null
		}
	},
	methods: {
		async signout() {
			let err = await this.$store.dispatch('SIGNOUT')
			if (err != null) console.error('Failed signing out:', err)
		},
		async sendMessage() {
			if (this.newMessage.length < 1) return
			let err = await this.$store.dispatch('PUSH_MESSAGE', this.newMessage)
			if (err != null) this.sendError = err
			this.newMessage = ''
		}
	}
}
</script>

<style lang="stylus">
.main-view
	max-width: 512px
	padding: 1rem
	box-sizing: border-box
	margin: auto
	& .connect-screen
		z-index: 999
		display: flex
		position: fixed
		width: 100%
		height: 100%
		top: 0px
		left: 0px
		justify-content: center
		align-items: center
		flex-direction: column
		background: rgba(0,0,0,.75)
		p
			color: white
			margin: .25rem
			&.server
				color: rgba(255,255,255,.5)
	& .header
		display: flex
		align-items: center
		justify-content: space-between
		padding-bottom: 1rem
		height: 3rem
		& .signin-button, & .signout-button
			padding: .5rem
			font-size: 1rem
			border: 1px solid #DDD
			border-radius: .25rem
			background: none
		& .page-title
			margin: 0rem
			font-size: 1rem
	& .message-list
		list-style-type: none
		padding: 0px
		margin-top: 1rem
		margin-bottom: 1rem
		& .message
			padding-top: 1rem
		& .message-header
			display: flex
			justify-content: space-between
			margin-bottom: .2rem
			& .message-author
				font-weight: bold
			& .message-time
				color: #AAA
				font-size: .8rem

	& .message-input
		position: relative
		bottom: 0px
		width: 100%
		background: none
		border: 1px solid #DDD
		border-radius: .2rem
		padding: .5rem
		box-sizing: border-box
</style>
