// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const JWT_SECRET = "studenthub_secret";

// ===== MONGODB SETUP =====
mongoose.connect("mongodb://127.0.0.1:27017/studenthub", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=>console.log("MongoDB connected")).catch(err=>console.error(err));

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
});

const budgetSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  income: Number,
  expenses: { food: Number, travel: Number, books: Number, others: Number },
  savings: Number
});

const savingsGoalSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  amount: Number,
  date: Date
});

const billSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  amount: Number,
  date: Date
});

const gigSchema = new mongoose.Schema({
  title: String,
  pay: String,
  location: String,
  schedule: String,
  urgent: Boolean
});

const chatSchema = new mongoose.Schema({
  channel: String,
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

// ===== MODELS =====
const User = mongoose.model("User", userSchema);
const Budget = mongoose.model("Budget", budgetSchema);
const SavingsGoal = mongoose.model("SavingsGoal", savingsGoalSchema);
const Bill = mongoose.model("Bill", billSchema);
const Gig = mongoose.model("Gig", gigSchema);
const Chat = mongoose.model("Chat", chatSchema);

// ===== AUTH ROUTES =====
app.post("/api/register", async (req,res)=>{
  const { username,email,password } = req.body;
  const hashed = await bcrypt.hash(password,10);
  const user = new User({ username,email,password:hashed });
  await user.save();
  res.json({ status:"ok" });
});

app.post("/api/login", async (req,res)=>{
  const { email,password } = req.body;
  const user = await User.findOne({ email });
  if(!user) return res.status(400).json({ error:"User not found" });
  const isValid = await bcrypt.compare(password,user.password);
  if(!isValid) return res.status(400).json({ error:"Invalid password" });
  const token = jwt.sign({ userId:user._id, username:user.username }, JWT_SECRET);
  res.json({ status:"ok", token, username:user.username });
});

// Middleware to verify JWT
function authMiddleware(req,res,next){
  const token = req.headers["authorization"];
  if(!token) return res.status(401).json({ error:"No token" });
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  }catch{
    res.status(401).json({ error:"Invalid token" });
  }
}

// ===== BUDGET =====
app.get("/api/budget", authMiddleware, async (req,res)=>{
  const budget = await Budget.findOne({ userId:req.userId });
  res.json(budget);
});

app.post("/api/budget", authMiddleware, async (req,res)=>{
  const { income, expenses, savings } = req.body;
  let budget = await Budget.findOne({ userId:req.userId });
  if(budget){
    budget.income = income;
    budget.expenses = expenses;
    budget.savings = savings;
    await budget.save();
  } else {
    budget = new Budget({ userId:req.userId, income, expenses, savings });
    await budget.save();
  }
  res.json(budget);
});

// ===== SAVINGS GOALS =====
app.get("/api/savingsGoals", authMiddleware, async (req,res)=>{
  const goals = await SavingsGoal.find({ userId:req.userId });
  res.json(goals);
});

app.post("/api/savingsGoals", authMiddleware, async (req,res)=>{
  const { name, amount, date } = req.body;
  const goal = new SavingsGoal({ userId:req.userId, name, amount, date });
  await goal.save();
  res.json(goal);
});

// ===== BILLS =====
app.get("/api/bills", authMiddleware, async (req,res)=>{
  const bills = await Bill.find({ userId:req.userId });
  res.json(bills);
});

app.post("/api/bills", authMiddleware, async (req,res)=>{
  const { name, amount, date } = req.body;
  const bill = new Bill({ userId:req.userId, name, amount, date });
  await bill.save();
  res.json(bill);
});

// ===== GIGS =====
app.get("/api/gigs", async (req,res)=>{
  const gigs = await Gig.find();
  res.json(gigs);
});

app.post("/api/gig-apps", authMiddleware, async (req,res)=>{
  // Could save applications to DB if needed
  res.json({ status:"success", data:req.body });
});

// ===== CHAT =====
app.get("/api/chats/:channel", authMiddleware, async (req,res)=>{
  const chats = await Chat.find({ channel:req.params.channel }).sort({ timestamp:1 });
  res.json(chats);
});

// ===== SOCKET.IO =====
io.on("connection", socket=>{
  console.log("User connected:", socket.id);

  socket.on("joinChannel", channel=>{
    socket.join(channel);
  });

  socket.on("sendMessage", async ({ channel, username, message })=>{
    const chat = new Chat({ channel, username, message });
    await chat.save();
    io.to(channel).emit("newMessage", chat);
  });

  socket.on("disconnect", ()=>console.log("User disconnected:", socket.id));
});

// ===== START SERVER =====
const PORT = 5000;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
