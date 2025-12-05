const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Contact = require("./models/Contact");

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/contacts";

app.use(cors());
app.use(express.json());

mongoose
  .connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/contacts", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contact = await Contact.create({ name, email, message });
    res.status(201).json(contact);
  } catch (err) {
    console.error("Error creating contact:", err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

app.listen(port, () => {
  console.log(`Contact service listening on port ${port}`);
});
