import express, { Request, Response } from "express";
import { conn, mysql, queryAsync } from "../dbconnect";
import { ParsedQs } from "qs";
import axios from 'axios';

export const router = express.Router();

router.get("/date-options", async (req: Request, res: Response) => {
    try {
        // Set the start date to 7 days ago from today
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 8); // Adjusted to go back exactly 7 days
        const formattedStartDate = startDate.toISOString().split('T')[0];

        // Set the end date to today
        const endDate = new Date();
        const formattedEndDate = endDate.toISOString().split('T')[0];

        const query = `
            SELECT DISTINCT DATE_FORMAT(time, '%Y-%m-%d') as date 
            FROM votes 
            WHERE time >= '${formattedStartDate} 00:00:00' AND time <= '${formattedEndDate} 23:59:59'
            GROUP BY date
        `;
        
        const result = await queryAsync(query);

        if (result && Array.isArray(result)) {
            const dateOptions = result.map((row: { date: string }) => row.date);
            res.json({ dateOptions });
        } else {
            console.error("Invalid result format");
            res.status(500).send("Internal Server Error");
        }
    } catch (error:any) {
        console.error("Error fetching date options:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



router.post("/data", async (req: Request, res: Response) => {
    const selectedDate = req.query.selectedDate;
    console.log('Selected Date:', selectedDate);
  
    const query = `
    SELECT u.user_id, u.first_name, u.last_name, u.icon, p.post_id, p.picture,
           DATE_FORMAT(MAX(v.time), '%Y-%m-%d %H:%i:%s') AS formatted_time,
            MAX(v.newRating) AS newRating
    FROM users u
    JOIN posts p ON u.user_id = p.user_id
    JOIN votes v ON p.post_id = v.post_id
    WHERE DATE(v.time) = ?
    GROUP BY u.user_id, u.first_name, u.last_name, u.icon, p.post_id, p.user_id, p.time, p.picture
    ORDER BY newRating DESC
    LIMIT 10;

  `;
  
    try {
      const result = await queryAsync(mysql.format(query, [selectedDate]));
      console.log('Generated SQL Query:', mysql.format(query, [selectedDate]));
      console.log('SQL Query Result:', result);
  
      if (Array.isArray(result) && result.length > 0) {
        console.log('Data retrieved:', result);
        res.json(result);
      } else {
        console.log('Data not found');
        res.status(404).json({ error: "Data not found" });
      }
    } catch (err: any) {
      console.error("Error fetching data:", err.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  
  