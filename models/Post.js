const postsCollection = require('../db').db().collection('posts')
const followsCollection = require('../db').db().collection('follow')
const ObjectID = require('mongodb').ObjectId //this will return user object unique id.see in action on line 17
const User = require('./User')
const sanitizeHTML = require('sanitize-html')
let Post = function (data, userid, requestedPostId) {
    this.data = data
    this.errors = []
    this.userid = userid
    this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function () {
    if (typeof (this.data.title) != "string") { this.data.title = "" }
    if (typeof (this.data.body) != "string") { this.data.title = "" }
    //now further safety process
    this.data = {
        title: sanitizeHTML(this.data.title.trim(), { allowedTags: [], allowedAttributes: {} }),
        body: sanitizeHTML(this.data.body.trim(), { allowedTags: [], allowedAttributes: {} }),
        date: new Date(),
        author: ObjectID(this.userid)
    }
}

Post.prototype.validate = function () {
    if (this.data.title == "") { this.errors.push("You must provide a title") }
    if (this.data.body == "") { this.errors.push("You must provide post content") }

}

Post.prototype.create = function () {
    return new Promise((resolve, reject) => {
        this.cleanUp()
        this.validate()

        if (!this.errors.length) {
            //save post into database
            postsCollection.insertOne(this.data).then((info) => {
                resolve(info.insertedId)
            }).catch(() => {
                this.errors.push("Please try again")
                reject(this.errors)
            })
        } else {
            reject(this.errors)
        }
    })
}

Post.reuseablePostQuery = function (uniqueOperations, visitorId) {
    return new Promise(async function (resolve, reject) {
        let aggOperations = uniqueOperations.concat([
            { $lookup: { from: "Users", localField: "author", foreignField: "_id", as: "authorDocument" } },
            {
                $project: {//Project operation allows what we want to get from above queries
                    title: 1,//1 for yes
                    body: 1,
                    date: 1,
                    authorId: "$author",
                    author: { $arrayElemAt: ["$authorDocument", 0] }// authorDocument we alias in above line

                }
            }
        ])
        let posts = await postsCollection.aggregate(aggOperations).toArray()

        posts = posts.map(function (post) {
            post.isVisitorOwner = post.authorId.equals(visitorId)
            post.author = {
                username: post.author.username,
                avatar: new User(post.author, true).avatar
            }
            return post
        })
        resolve(posts)
    })
}

Post.findSingleById = function (id, visitorId) {
    return new Promise(async function (resolve, reject) {
        if (typeof (id) != "string" || !ObjectID.isValid(id)) {
            reject()
            return
        }
        //aggregate function allow us to perform multiple Monngodb operations and then we are 
        //converting them to array
        let posts = await Post.reuseablePostQuery([
            { $match: { _id: new ObjectID(id) } }
        ], visitorId)

        if (posts.length) {
            resolve(posts[0])
        } else {
            reject()
        }
    })
}

Post.findByAuthorId = function (authorId) {
    return Post.reuseablePostQuery([
        { $match: { author: authorId } },
        { $sort: { date: -1 } }
    ])
}

Post.prototype.actuallyUpdate = function () {
    return new Promise(async (resolve, reject) => {
        this.cleanUp()
        this.validate()
        if (!this.errors.length) {
            await postsCollection.findOneAndUpdate({ _id: new ObjectID(this.requestedPostId) }, { $set: { title: this.data.title, body: this.data.body } })
            resolve("success")
        } else {

            reject("fail")
        }
    })
}

Post.prototype.update = function () {
    return new Promise(async (resolve, reject) => {
        try {
            let post = await Post.findSingleById(this.requestedPostId, this.userid)
            if (post.isVisitorOwner) {
                this.actuallyUpdate().then((status) => resolve(status)).catch((status) => resolve(status))
            } else {
                reject()
            }
        } catch {
            reject()
        }
    })
}

Post.delete = function (postIdToDelete, currentUserId) {
    return new Promise(async (resolve, reject) => {
        try {
            let post = await Post.findSingleById(postIdToDelete, currentUserId)
            if (post.isVisitorOwner) {
                await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) })
                resolve()
            } else {
                reject()
            }
        } catch {
            reject()
        }
    })
}

Post.search = function (searchTerm) {
    return new Promise(async (resolve, reject) => {

        if (typeof (searchTerm) == "string") {
            let posts = await Post.reuseablePostQuery([
                { $match: { $text: { $search: searchTerm } } }
            ])

            resolve(posts)
        } else {
            reject()
        }
    })
}

Post.countPostByAuthor = function (id) {
    return new Promise(async (resolve, reject) => {
        let postCount = await postsCollection.countDocuments({ author: id })
        resolve(postCount)
    })
}

Post.getFeed = async function (id) {
    //create an array of user ids that the current user follows
    let followedUsers = await followsCollection.find({ authorId: new ObjectID(id) }).toArray()
    followedUsers = followedUsers.map((followDoc) => {
        return followDoc.followedId
    })
    //look for the posts where the author is in the above array of followed users
    return Post.reuseablePostQuery([
        { $match: { author: { $in: followedUsers } } },
        { $sort: { date: -1 } }
    ])
}

module.exports = Post