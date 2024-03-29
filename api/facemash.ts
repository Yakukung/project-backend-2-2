import express from "express";
import { conn, queryAsync } from "../dbconnect";


export const router = express.Router();



// ล็อคอิน
router.post("/signin", (req, res) => {
  let user_email = req.body.email;
  let user_password = req.body.password;
  conn.query('SELECT * FROM users WHERE email = ? AND password = ?', [user_email, user_password], (err, result, fields) => {
      if (err) {
          console.error("Error during sign-in:", err);
          res.status(500).json({ error: "Internal Server Error" });
      } else {
          res.json(result);
      }
  });
});

router.post('/signup', (req, res) => {
  const { first_name, last_name, email, password ,user_type} = req.body;
  console.log('Received data:', { first_name, last_name, email, password ,user_type});

  conn.query('SELECT * FROM users WHERE email = ?', [email], (selectErr, selectResult) => {
    if (selectErr) {
      console.error('Error during email existence check:', selectErr);
      res.status(500).json({ error: 'Internal Server Error', details: selectErr.message });

    } else if (selectResult.length > 0) {
      console.error('Email already in use. Please choose a different email.');
      res.status(409).json({ error: 'Email already in use. Please choose a different email.' });

    } else {
  conn.query('INSERT INTO users (first_name, last_name, email, password, user_type) VALUES (?, ?, ?, ?, "user")',
  [first_name, last_name, email, password, user_type],
  (err, result) => {
    if (err) {
      console.error('Error during user signup:', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } else {
      console.log('User successfully signed up:', result);
      res.json({ message: 'User signed up successfully' });
    }
  }
);
}
});
});


router.put("/reset-password", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // ตรวจสอบว่ามีอีเมลในฐานข้อมูลหรือไม่
  conn.query('SELECT * FROM users WHERE email = ?', [email], (err, result, fields) => {
    if (err) {
      console.error("Error during email check:", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      if (result.length > 0) {
        // หากพบอีเมลในฐานข้อมูล ให้ทำการอัพเดตรหัสผ่าน
        conn.query('UPDATE users SET password = ? WHERE email = ?', [password, email], (err, updateResult, fields) => {
          if (err) {
            console.error("Error during password update:", err);
            res.status(500).json({ error: "Internal Server Error" });
          } else {
            res.json({ success: true, message: "Password updated successfully." });
          }
        });
      } else {
        res.status(404).json({ error: "Email not found." });
      }
    }
  });
});


router.post("/homepage", (req, res) => {
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

router.post("/navbar", (req, res) => {
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

