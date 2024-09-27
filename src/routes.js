const express = require('express');
const router = express.Router();
const db = require('./db');

// Sample route to get data from the table
router.get('/users', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database query error' });
    }
});

module.exports = router;
