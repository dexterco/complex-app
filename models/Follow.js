const ObjectID = require('mongodb').ObjectID
const User = require('./User')
const usersCollection = require('../db').db().collection("Users")
const followCollection = require('../db').db().collection("follow")
let Follow = function (followedUsername, authorId) {
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function () {
    if (typeof (this.followedUsername) != "string") { this.followedUsername = "" }
}

Follow.prototype.validate = async function (action) {
    //followedusername must exsit in database
    let followedAccount = await usersCollection.findOne({ username: this.followedUsername })
    if (followedAccount) {
        this.followedId = followedAccount._id
    } else {
        this.errors.push("You cannot follow a user that does not exist")
    }

    let doesFollowAlreadyExist = await followCollection.findOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })

    if (action == "create") {
        if (doesFollowAlreadyExist) {
            this.errors.push("You are already following this user")
        }
    }

    if (action == "delete") {
        if (!doesFollowAlreadyExist) {
            this.errors.push("You cannot stop following someone you already do not follow")
        }
    }

    //should not be able to follow yourself
    if (this.followedId.equals(this.authorId)) {
        this.errors.push("You cannot follow yourself")
    }
}

Follow.prototype.create = function () {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("create")
        if (!this.errors.length) {
            await followCollection.insertOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
            resolve()
        } else {
            reject(this.errors)
        }

    })
}

Follow.prototype.delete = function () {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        await this.validate("delete")
        if (!this.errors.length) {
            await followCollection.deleteOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
            resolve()
        } else {
            reject(this.errors)
        }

    })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
    let followDoc = await followCollection.findOne({ followedId: followedId, authorId: new ObjectID(visitorId) })
    if (followDoc) {
        return true
    } else {
        return false
    }
}

Follow.getFollowersById = function (id) {
    return new Promise(async (resolve, reject) => {
        try {
            let followers = await followCollection.aggregate([
                { $match: { followedId: id } },
                { $lookup: { from: "Users", localField: "authorId", foreignField: "_id", as: "userDoc" } },
                {
                    $project: {
                        username: { $arrayElemAt: ["$userDoc.username", 0] },
                        email: { $arrayElemAt: ["$userDoc.email", 0] }
                    }
                }
            ]).toArray()
            followers = followers.map(function (follower) {
                let user = new User(follower, true)
                return { username: follower.username, avatar: user.avatar }
            })
            resolve(followers)
        } catch {
            reject()
        }

    })

}

Follow.getFollowingById = function (id) {
    return new Promise(async (resolve, reject) => {
        try {
            let following = await followCollection.aggregate([
                { $match: { authorId: id } },
                { $lookup: { from: "Users", localField: "followedId", foreignField: "_id", as: "userDoc" } },
                {
                    $project: {
                        username: { $arrayElemAt: ["$userDoc.username", 0] },
                        email: { $arrayElemAt: ["$userDoc.email", 0] }
                    }
                }
            ]).toArray()
            following = following.map(function (follower) {
                let user = new User(follower, true)
                return { username: follower.username, avatar: user.avatar }
            })
            resolve(following)
        } catch {
            reject()
        }

    })

}

Follow.countFollowersById = function (id) {
    return new Promise(async (resolve, reject) => {
        let followersCount = await followCollection.countDocuments({ followedId: id })
        resolve(followersCount)
    })
}

Follow.countFollowingById = function (id) {
    return new Promise(async (resolve, reject) => {
        let followingCount = await followCollection.countDocuments({ authorId: id })
        resolve(followingCount)
    })
}

module.exports = Follow 