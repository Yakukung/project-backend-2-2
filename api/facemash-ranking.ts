import express, { Request, Response } from "express";
import { conn, mysql, queryAsync } from "../dbconnect";
import { ParsedQs } from "qs";
import axios from 'axios';

export const router = express.Router();

router.get("/date-options", async (req: Request, res: Response) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const formattedStartDate = startDate.toISOString().split('T')[0];

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999); // Set to the end of the day
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
    const selectedDate: string = req.query.selectedDate as string;
    console.log('Selected Date:', selectedDate);

    const query = `

        SELECT u.user_id, u.first_name, u.last_name, u.icon, p.post_id, p.picture,
               DATE_FORMAT(MAX(v.time), '%Y-%m-%d %H:%i:%s') AS formatted_time,
               MAX(v.newRating) AS newRating
        FROM users u
        JOIN posts p ON u.user_id = p.user_id
        JOIN (
                SELECT post_id, MAX(time) AS max_time
                FROM votes
                WHERE DATE(time) = ?
                GROUP BY post_id
             ) AS latest_votes ON p.post_id = latest_votes.post_id
        JOIN votes v ON latest_votes.post_id = v.post_id AND latest_votes.max_time = v.time
        GROUP BY u.user_id, u.first_name, u.last_name,  u.icon, p.post_id, p.picture
        ORDER BY newRating DESC;
    `;

    try {
        // Query ข้อมูลโพสต์ตามวันที่ที่ผู้ใช้เลือก
        const result = await queryAsync(mysql.format(query, [selectedDate]));
        console.log('Generated SQL Query:', mysql.format(query, [selectedDate]));
        console.log('SQL Query Result:', result);

        if (Array.isArray(result) && result.length > 0) {
            console.log('Data retrieved:', result);

            // ดึงข้อมูลโพสต์จากวันก่อนหน้า
            const previousDate = new Date(selectedDate);
            previousDate.setDate(previousDate.getDate() - 1); // ลดลงหนึ่งวันก่อนที่จะดึงข้อมูลของวันก่อนหน้านั้น
            const formattedPreviousDate = previousDate.toISOString().split('T')[0];

            const previousResult = await queryAsync(mysql.format(query, [formattedPreviousDate]));
            console.log('Generated SQL Query for Previous Date:', mysql.format(query, [formattedPreviousDate]));
            console.log('SQL Query Result for Previous Date:', previousResult);

            if (Array.isArray(previousResult) && previousResult.length > 0) {
                result.forEach((post: any) => {
                    const previousPost = previousResult.find((previousPost: any) => previousPost.post_id === post.post_id);
                    const oldRank = previousPost ? previousResult.indexOf(previousPost) + 1 : 0;
                    const newRank = result.indexOf(post) + 1;
                    const deltaRank = previousPost ? oldRank - newRank : 0;
                    const status = deltaRank < 0 ? "ลด" : deltaRank > 0 ? "เพิ่ม" : "ไม่เปลี่ยนแปลง";

                    // เพิ่มเงื่อนไขเพิ่มหรือลดลงในการตรวจสอบ deltaRank
                    const rankChange = deltaRank !== 0 ? (deltaRank < 0 ? "ลดลง" : "เพิ่มขึ้น") : "ไม่เปลี่ยนแปลง";

                    // คำนวณคะแนนเพิ่มหรือลด
                    let deltaNewRating = 0;
                    if (previousPost) {
                        const previousNewRating = previousPost.newRating;
                        const currentNewRating = post.newRating;
                        deltaNewRating = currentNewRating - previousNewRating;
                    }

                    // แสดงผลลัพธ์การเพิ่มหรือลดอันดับพร้อมสถานะและคะแนนเพิ่มหรือลด
                    const sign = deltaNewRating >= 0 ? "+" : "-";
                    console.log(`Post ID: ${post.post_id}, Old Rank: ${oldRank}, New Rank: ${newRank}, Delta Rank: ${Math.abs(deltaRank)} (${status}), Delta Rating: ${sign}${Math.abs(deltaNewRating)} (${selectedDate} -> ${formattedPreviousDate}), Rank Change: ${rankChange}`);

                    // เพิ่มค่า Rating เก่าในข้อมูลโพสต์
                    post.previousNewRating = previousPost ? previousPost.newRating : null;
                    post.deltaRank = deltaRank;
                    post.status = status;
                    post.deltaNewRating = deltaNewRating;
                    post.oldRank = oldRank;
                    post.rankChange = rankChange; // เพิ่มข้อมูลการเปลี่ยนแปลงลำดับ
                });

            }
            res.json(result); // ส่งข้อมูลโพสต์ที่ได้รับจากการ query พร้อมข้อมูลการเปลี่ยนแปลงอันดับกลับไปยังผู้ใช้
        } else {
            console.log('Data not found');
            res.status(404).json({ error: "Data not found" }); // ส่งข้อความแจ้งเตือนว่าไม่พบข้อมูลโพสต์ในวันที่เลือก
        }

    } catch (err: any) {
        console.error("Error fetching data:", err.message);
        res.status(500).json({ error: "Internal Server Error" }); // ส่งข้อความแจ้งเตือนว่ามีข้อผิดพลาดภายในเซิร์ฟเวอร์
    }
});
