const express = require("express");
const db = require("./db");
const { amqp } = require("./utils/amqp");

const router = express.Router();

// Sample route to get data from the table
router.get("/users", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users");
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Database query error" });
  }
});

router.post("/stories", async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await db.query(
      "INSERT INTO stories (user_prompt) VALUES ($1) RETURNING *",
      [{ main: prompt }]
    );
    await amqp.publishMessage("SimpleRoutingKey", {
      prompt: "this is a sample prompt",
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Database query error" });
  }
});

module.exports = router;
