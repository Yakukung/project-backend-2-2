// facemash-graph.ts
import express from "express";
import { conn } from "../dbconnect";
import { Request, Response, Router } from "express";

export const router = express.Router();


router.post("/select-post", (req: Request, res: Response) => {
  const post_id = req.body.post_id;
  conn.query(
    `SELECT 
      DATE_FORMAT(v.time, '%Y-%m-%d') AS vote_date, v.newRating, v.newRank, v.post_id, p.picture, u.first_name, u.last_name
    FROM votes v
    JOIN posts p ON v.post_id = p.post_id
    JOIN users u ON p.user_id = u.user_id
    WHERE v.post_id = ?
    GROUP BY vote_date, v.post_id, p.picture, p.newRank, v.newRating, v.newRank, u.first_name, u.last_name
    ORDER BY vote_date ASC;
`,
    [post_id],
    (err: any, result: any[]) => {
      if (err) {
        res.json(err);
      } else {
        const formattedResults: any[] = [];
        result.forEach((row: any) => {
          const { vote_date, post_id, newRating, picture, newRank, first_name, last_name } = row;
          const formattedDate = new Date(vote_date).toISOString().split("T")[0];
          formattedResults.push({
            vote_date: formattedDate,
            post_id,
            newRating,
            picture,
            newRank,
            first_name,
            last_name 
          });
        });
        res.json(formattedResults);
      }
    }
  );
});


router.post("/show-user-post-all", (req: Request, res: Response) => {
  const user_id = req.body.user_id;
  conn.query(
    `SELECT 
        DATE_FORMAT(v.time, '%Y-%m-%d') AS vote_date, v.newRating, v.newRank, v.post_id, p.picture, u.user_id, u.first_name, u.last_name
      FROM users u
      JOIN posts p ON u.user_id = p.user_id
      JOIN votes v ON v.post_id = p.post_id
      WHERE u.user_id = ?
      GROUP BY vote_date, v.post_id, p.picture, p.newRank, v.newRating, v.newRank, u.first_name, u.last_name
      ORDER BY vote_date ASC;`,
    [user_id],
    (err: any, result: any[]) => {
      if (err) {
        res.json(err);
      } else {
        const formattedResults: any[] = [];
        result.forEach((row: any) => {
          const { vote_date, post_id, newRating, picture, newRank, first_name, last_name } = row;
          const formattedDate = new Date(vote_date).toISOString().split("T")[0];
          formattedResults.push({
            vote_date: formattedDate,
            post_id,
            newRating,
            picture,
            newRank,
            first_name,
            last_name 
          });
        });
        res.json(formattedResults);
      }
    }
  );
});
