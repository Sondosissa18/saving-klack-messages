const express = require("express");
const querystring = require("querystring");
const port = 3000;
const app = express();
const MongoClient = require("mongodb").MongoClient;
const assert = require("assert");
const mongoose = require("mongoose");

const url = "mongodb://localhost:27017/klack";
mongoose.connect(url, { useNewUrlParser: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {});

// List of all messages
// let messages = [];
const messagesSchema = new mongoose.Schema({
  sender: String,
  message: String,
  timestamp: Number,
});

// Track last active times for each sender
const messageModel = mongoose.model("message", messagesSchema);

let users = {};

app.use(express.static("./public"));
app.use(express.json());

// generic comparison function for case-insensitive alphabetic sorting on the name field
function userSortFn(a, b) {
  var nameA = a.name.toUpperCase(); // ignore upper and lowercase
  var nameB = b.name.toUpperCase(); // ignore upper and lowercase
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }

  // names must be equal
  return 0;
}

app.get("/messages", async (request, response) => {
  try {
    // get the current time
    const now = Date.now();
    const messages = await messageModel
      .find({
        name: request.query.for,
      })
      .sort({ timestamp: -1 })
      .limit(40);

    // consider users active if they have connected (GET or POST) in last 15 seconds
    const requireActiveSince = now - 15 * 1000;

    // create a new list of users with a flag indicating whether they have been active recently
    usersSimple = Object.keys(users).map((x) => ({
      name: x,
      active: users[x] > requireActiveSince,
    }));

    // sort the list of users alphabetically by name
    usersSimple.sort(userSortFn);
    usersSimple.filter((a) => a.name !== request.query.for);

    // update the requesting user's last access time
    users[request.query.for] = now;

    // send the latest 40 messages and the full user list, annotated with active flags
    response.send({ messages: messages, users: usersSimple });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/messages", async (request, response) => {
  // add a timestamp to each incoming message.
  const timestamp = Date.now();
  request.body.timestamp = timestamp;
  try {
    await messageModel.create(request.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }

  // update the posting user's last access timestamp (so we know they are active)
  users[request.body.sender] = timestamp;

  // Send back the successful response.
  response.status(201);
  response.send(request.body);
});

app.listen(3000);
