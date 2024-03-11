import express from "express";
import { conn, queryAsync } from "../dbconnect";
import { users } from "../model/user";
import bodyParser from 'body-parser';
import multer from "multer";
import fs from 'fs';

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
      // Email already exists, send a response indicating the conflict
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

router.post("/profile", (req, res) => {
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



//แสดงข้อมูล  โหวต  2 คน
router.post("/vote", (req, res) => {
  conn.query('SELECT * FROM posts INNER JOIN users ON posts.user_id = users.user_id;', (err, result, fields) => {
    if (err) {
      res.json(err);
    } else {
      const randomIndexes: number[] = [];
  
      while (randomIndexes.length < 2) {
        const randomIndex = Math.floor(Math.random() * result.length);
  
        const previousIndex = randomIndexes[randomIndexes.length - 1];
        const selectedUserId = result[randomIndex].user_id;
        const previousUserId = previousIndex !== undefined ? result[previousIndex].user_id : undefined;
  
        if (previousUserId !== selectedUserId) {
          randomIndexes.push(randomIndex);
        }
      }
  
      const randomImages = randomIndexes.map((index) => result[index]);
  
      res.json(randomImages);
    }
  });
  });



router.put("/vote/", (req, res) => {
  const postId = req.body.postId;
  console.log('Score post_id:', postId);

  conn.query('UPDATE posts SET score = score + 1 WHERE post_id = ?', [postId], (updateErr, updateResult) => {
    if (updateErr) {
      console.error('Error updating score:', updateErr);
      res.status(500).json({ error: "Error updating score" });
    } else {
      if (updateResult.affectedRows === 0) {
        res.status(404).json({ error: "Post not found for the given post_id" });
      } else {
        conn.query('SELECT * FROM posts WHERE post_id = ?', [postId], (selectErr, selectResult) => {
          if (selectErr) {
            console.error('Error retrieving updated post:', selectErr);
            res.status(500).json({ error: "Error retrieving updated post" });
          } else {
            const updatedPost = selectResult[0];
            res.json({ message: 'Vote successfully recorded', updatedPost });
          }
        });
      }
    }
  });
});

router.put("/ranking/", (req, res) => {
  const postId = req.body.postId;
  console.log('Score post_id:', postId);

  conn.query('SELECT * FROM users', (err, usersResults) => {
    if (err) {
      console.error('Error querying users:', err);
      return res.status(500).send('Internal Server Error');
    }
  
    console.log('Users Results:', usersResults);
  

    conn.query('SELECT * FROM posts', (err, postsResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }

      conn.query('SELECT * FROM votes', (err, votesResults) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Internal Server Error');
        }

        const responseData = {
          users: usersResults,
          posts: postsResults,
          votes: votesResults,
        };

        res.json(responseData);
        console.log('ข้อมูลทั้งหมด:', responseData);
      });
    });
  });
});







