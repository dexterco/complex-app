const usersCollection = require('../db').db().collection("Users")
const md5 = require('md5')
const bcrypt = require('bcryptjs')
const validator = require('validator')
let User = function (data, getAvatar) {
	this.data = data
	this.errors = []
	if (getAvatar == undefined) { getAvatar = false }
	if (getAvatar) { this.getAvatar() }
}
User.prototype.cleanUp = function () {
	if (typeof (this.data.username) != "string") { this.data.username = "" }
	if (typeof (this.data.email) != "string") { this.data.email = "" }
	if (typeof (this.data.password) != "string") { this.data.password = "" }
	//clean up the bogus values if any
	this.data = {
		username: this.data.username.trim().toLowerCase(),
		email: this.data.email.trim().toLowerCase(),
		password: this.data.password
	}
}
User.prototype.validate = function () {
	return new Promise(async (resolve, reject) => {
		if (this.data.username == "") { this.errors.push("You must provide a User Name.") }
		if (this.data.username != "" && !validator.isAlphanumeric(this.data.username)) { this.errors.push("Username can only contain number and letters.") }
		if (!validator.isEmail(this.data.email)) { this.errors.push("You must provide a valid email.") }
		if (this.data.password == "") { this.errors.push("You must provide a password.") }
		if (this.data.password.length > 0 && this.data.password.length < 12) { this.errors.push("Password must be 12 characters long.") }
		if (this.data.password.length > 50) { this.errors.push("Password cannot exceed from 50 characters.") }
		if (this.data.username.length > 0 && this.data.username.length < 3) { this.errors.push("User name must be 3 characters long.") }
		if (this.data.username.length > 30) { this.errors.push("User name cannot exceed from 30 characters") }

		//only if username is valid then check to see  if it is already taken
		if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
			let usernameExist = await usersCollection.findOne({ username: this.data.username })
			if (usernameExist) { this.errors.push("That username is already taken") }

		}
		//now check for email
		if (validator.isEmail(this.data.email)) {
			let emailExist = await usersCollection.findOne({ email: this.data.email })
			if (emailExist) { this.errors.push("That email is already being used") }
		}
		resolve()
	})
}

User.prototype.login = function () {
	return new Promise((resolve, reject) => {
		this.cleanUp()
		usersCollection.findOne({ username: this.data.username }).then((attemptedUser) => {
			//very important always use arrow function if there is a 'this' keyword inside it
			if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
				this.data = attemptedUser
				this.getAvatar()
				resolve("Congrats!")
			} else {
				reject("Invalid Username/Password")
			}
		}).catch(function () {
			reject("Please try again later")
		})
		// usersCollection.findOne({ username: this.data.username }, (error, attemptedUser) => {
		// 	if (attemptedUser && attemptedUser.password == this.data.password) {
		// 		resolve("Congrats!")
		// 	} else {
		// 		reject("Invalid Username/Password")
		// 	}
		// })we can also use this to handle login request Nabeel keep in mind
	})
}
User.prototype.register = function () {
	return new Promise(async (resolve, reject) => {
		//#1validate user data
		//before validating clean up the code
		this.cleanUp()
		await this.validate()
		//#2 Now if there are no errors than save it to database
		if (!this.errors.length) {
			let salt = bcrypt.genSaltSync(10)
			this.data.password = bcrypt.hashSync(this.data.password, salt)
			await usersCollection.insertOne(this.data)
			this.getAvatar()
			resolve()
		} else {
			reject(this.errors)
		}
	})
}

User.prototype.getAvatar = function () {
	this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}
User.findByUsername = function (username) {
	return new Promise(function (resolve, reject) {

		if (typeof (username) != "string") {
			reject()
			return
		}
		usersCollection.findOne({ username: username }).then(function (userDoc) {
			if (userDoc) {
				userDoc = new User(userDoc, true)
				userDoc = {
					_id: userDoc.data._id,
					username: userDoc.data.username,
					avatar: userDoc.avatar
				}
				resolve(userDoc)
			} else {
				reject()
			}
		}).catch(function () {
			reject()
		})
	})
}

module.exports = User