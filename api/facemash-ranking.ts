import express from "express";
import { conn, queryAsync } from "../dbconnect";

export const router = express.Router();

router.get("/", (req, res) => {
    conn.query('SELECT u.user_id, CONCAT(u.first_name, " ", u.last_name) AS full_name, u.icon, p.*, v.* FROM users u JOIN posts p ON u.user_id = p.user_id JOIN votes v ON p.post_id = v.post_id ORDER BY p.score DESC', (err, result, fields) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.json(result);
        console.log(result);
    });
});



