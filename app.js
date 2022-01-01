const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked') //marking user html  
const sanitizeHTML = require('sanitize-html')
const app = express()
const router = require('./router')
let sessionOptions = session({
    secret: "Wonderland is the key",
    store: MongoStore.create({ client: require('./db') }),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true }
})
app.use(flash())
app.use(sessionOptions)
app.use(express.urlencoded({ extended: false }))//getting data through req.body
app.use(express.json())//getting data through req.body
app.use(express.static('public'))//for static file like css
app.set('views', 'views')
app.set('view engine', 'ejs')
app.use(function (req, res, next) {// must be write before requiring the router
    //make our markdown function available to ejs templates
    res.locals.filterUserHTML = function (content) {
        return sanitizeHTML(markdown.parse(content), { allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'bold', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], allowedAttributes: {} })
    }
    //make available user id on req object
    if (req.session.user) { req.visitorId = req.session.user._id } else { req.visitorId = 0 }
    //make available flash msg data to ejs templates
    res.locals.errors = req.flash("errors")
    res.locals.success = req.flash("success")
    //make available user object on ejs templates
    res.locals.user = req.session.user
    next()
})
app.use('/', router)
module.exports = app