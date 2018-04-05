export default function asciiArrayToStr(byteArray) {
	let out = ""
	for (let i = 0; i < byteArray.length; i++) {
		out += String.fromCharCode(byteArray[i])
	}
	return out
}
