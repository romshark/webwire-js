<template>
<div id="app">
	<transition name="fade" mode="out-in">
		<router-view class="view"></router-view>
	</transition>
</div>
</template>

<script>
export default {
	async created() {
		// Initialize API client only in the browser
		if (!process.browser) return
		let err = await this.$store.dispatch('CONNECT')
		if (err != null) console.error('Couldn\'t connect: ', err)
	}
}
</script>

<style lang="stylus">
html, body
	height: 100%
	width: 100%

body
	font-size: 0px

#app
	height: 100%
	width: 100%
	background: black

h1
	font-size: 2rem

h2
	font-size: 1.5rem

h3
	font-size: 1.2rem

p, span, b, i, a, input, textarea
	font-size: 1rem

body
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
	background-color: lighten(#eceef1, 30%)
	margin: 0px
	color: #34495e

a
	color: inherit
	text-decoration: none
</style>
