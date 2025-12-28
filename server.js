const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // serve frontend files

// ===== MONGODB SETUP =====
mongoose.connect("mongodb://127.0.0.1:27017/studenthub", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const chatSchema = new mongoose.Schema({
  channel: String,
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const gigSchema = new mongoose.Schema({
  title: String,
  name: String,
  email: String,
  note: String,
  timestamp: { type: Date, default: Date.now }
});

const Chat = mongoose.model("Chat", chatSchema);
const Gig = mongoose.model("Gig", gigSchema);

// ===== API ROUTES =====
// Get all chat messages for a channel
app.get("/api/chats/:channel", async (req, res) => {
  const channel = req.params.channel;
  const messages = await Chat.find({ channel }).sort({ timestamp: 1 });
  res.json(messages);
});

// Post gig application
app.post("/api/gigs", async (req, res) => {
  const { title, name, email, note } = req.body;
  const newGig = new Gig({ title, name, email, note });
  await newGig.save();
  res.json({ success: true, message: "Application submitted" });
});

// ===== SOCKET.IO FOR REAL-TIME CHAT =====
io.on("connection", (socket) => {
  console.log("New client connected");

  // Join channel
  socket.on("joinChannel", (channel) => {
    socket.join(channel);
  });

  // Send message
  socket.on("sendMessage", async (data) => {
    const { channel, username, message } = data;
    const chat = new Chat({ channel, username, message });
    await chat.save();
    io.to(channel).emit("receiveMessage", chat);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
