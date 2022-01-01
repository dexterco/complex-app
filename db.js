const { MongoClient } = require("mongodb")
const dotenv = require('dotenv')
dotenv.config()
const databaseName = "wonderland"

MongoClient.connect(process.env.CONNECTIONSTRING, { useNewUrlParser: true }, (error, client) => {
    if (error) {
        return console.log("Connection failed for some reason")
    }
    console.log("Connection established - All well")
    module.exports = client
    const app = require('./app.js')
    app.listen(process.env.PORT)
});