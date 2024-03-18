// facemash-graph.ts
import express from "express";
import { conn } from "../dbconnect";
import { Request, Response, Router } from "express";

export const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  conn.query(
    `SELECT 
        DATE_FORMAT(v.time, '%Y-%m-%d') as vote_date, 
        MAX(v.newRating) as newRating,
        v.post_id, 
        MAX(v.vote_id) as max_vote_id, 
        p.picture
    FROM votes v
    LEFT JOIN posts p ON v.post_id = p.post_id
    JOIN (
        SELECT post_id, MAX(time) AS max_time
        FROM votes
        GROUP BY post_id, DATE(time)
    ) AS latest_votes ON v.post_id = latest_votes.post_id AND v.time = latest_votes.max_time
    GROUP BY vote_date, v.post_id, p.picture
    ORDER BY vote_date ASC;`,
    (err: any, result: any[]) => {
      if (err) {
        res.json(err);
      } else {
        const separatedResults: {
          [key: string]: {
            post_id: number;
            max_vote_id: number;
            newRating: number;
            picture: string;
          }[];
        } = {};
        result.forEach((row: any) => {
          const { vote_date, post_id, max_vote_id, newRating, picture } = row;
          const formattedDate = new Date(vote_date).toISOString().split("T")[0];
          if (!separatedResults[formattedDate]) {
            separatedResults[formattedDate] = [];
          }
          separatedResults[formattedDate].push({
            post_id,
            max_vote_id,
            newRating,
            picture,
          });
        });
        const formattedResults: any[] = [];
        for (const [vote_date, data] of Object.entries(separatedResults)) {
          formattedResults.push({ vote_date, data });
        }
        res.json(formattedResults);
      }
    }
  );
});


router.post("/show-graph-post", (req: Request, res: Response) => {
  const post_id = req.body.post_id;
  conn.query(
    `SELECT 
    DATE_FORMAT(v.time, '%Y-%m-%d') AS vote_date, 
    MAX(v.newRating) AS newRating,
    MAX(v.newRank) AS newRank,
    v.post_id,
    p.picture
FROM votes v
JOIN (
    SELECT post_id, MAX(time) AS max_time
    FROM votes
    GROUP BY post_id, DATE(time)
) AS latest_votes ON v.post_id = latest_votes.post_id AND v.time = latest_votes.max_time
JOIN posts p ON v.post_id = p.post_id
WHERE v.post_id = ?
GROUP BY vote_date, v.post_id, p.picture, p.newRank
ORDER BY vote_date DESC;
`,
    [post_id],
    (err: any, result: any[]) => {
      if (err) {
        res.json(err);
      } else {
        const formattedResults: any[] = [];
        result.forEach((row: any) => {
          const { vote_date, post_id, newRating, picture, newRank} = row;
          const formattedDate = new Date(vote_date).toISOString().split("T")[0];
          formattedResults.push({
            vote_date: formattedDate,
            post_id,
            newRating,
            picture,
            newRank
            ,
          });
        });
        res.json(formattedResults);
      }
    }
  );
});
