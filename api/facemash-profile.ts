import express from "express";
import { conn, queryAsync } from "../dbconnect";

export const router = express.Router();

router.post("/", (req, res) => {
    const user_id = req.body.user_id;
    const query = `
      SELECT 
        users.*, 
        JSON_ARRAYAGG(JSON_OBJECT('post_id', posts.post_id, 'picture', posts.picture, 'score', posts.score,  'time', DATE_FORMAT(posts.time, '%H:%i — %M %e, %Y'))) AS posts
      FROM users 
      LEFT JOIN posts ON users.user_id = posts.user_id 
      WHERE users.user_id = ?
      GROUP BY users.user_id`;
  
    console.log('Request received with user_id:', user_id);
  
    conn.query(query, [user_id], (err, result, fields) => {
      if (err) {
        console.error("Error fetching user data:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        if (result.length > 0) {
          console.log('User data retrieved:', result[0]);
          res.json(result[0]);
        } else {
          console.log('User not found');
          res.status(404).json({ error: "User not found" });
        }
      }
    });
  });
  
  router.post("/show-user", (req, res) => {
    const user_id = req.body.user_id;
    conn.query('SELECT * FROM users WHERE user_id = ?', [user_id], (err, result, fields) => {
      if (err) {
        console.error("Error fetching user data:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        if (result.length > 0) {
          const user_data = result[0];
          res.json(user_data);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      }
    });
  });
  
  
  
  
  
  
  