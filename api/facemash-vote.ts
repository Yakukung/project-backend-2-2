// facemash-vote.ts
import express from "express";
import { conn } from "../dbconnect";
import { Request, Response, Router } from 'express';

export const router = express.Router();
 
router.get("/", (req, res) => {
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



router.post('/', async (req: Request, res: Response) => {
    try {
        const { winnerPostId, loserPostId } = req.body;

        // 2. ตรวจสอบโพสต์ผู้ชนะและผู้แพ้:
        const [selectedWinner] = await queryAsync('SELECT * FROM posts WHERE post_id = ?', [winnerPostId]);
        const [selectedLoser] = await queryAsync('SELECT * FROM posts WHERE post_id = ?', [loserPostId]);

        if (!selectedWinner || !selectedLoser) {
            return res.status(404).json({ error: 'Winner or loser post not found' });
        }

        // 3. คำนวณ Elo Rating:
        const opponentEloRatingWinner = selectedWinner.score;
        const opponentEloRatingLoser = selectedLoser.score;

        const { updatedEloRating: updatedEloRatingWinner, oldRating: oldRatingWinner } = calculateUpdatedEloRating(
            selectedWinner.score,
            opponentEloRatingWinner,
            true
        );

        const { updatedEloRating: updatedEloRatingLoser, oldRating: oldRatingLoser } = calculateUpdatedEloRating(
            selectedLoser.score,
            opponentEloRatingLoser,
            false
        );

        // 4. อัปเดต Elo Rating และคะแนนในฐานข้อมูล:
        await queryAsync('UPDATE posts SET score = ? WHERE post_id = ?', [updatedEloRatingWinner, winnerPostId]);
        await queryAsync('UPDATE posts SET score = ? WHERE post_id = ?', [updatedEloRatingLoser, loserPostId]);

        // 5. ดึงข้อมูลโพสต์ที่อัปเดต:
        const [updatedWinner] = await queryAsync('SELECT * FROM posts WHERE post_id = ?', [winnerPostId]);
        const [updatedLoser] = await queryAsync('SELECT * FROM posts WHERE post_id = ?', [loserPostId]);

        // 6. นำคะแนน `score` มาใส่ในตาราง `votes`:
        await queryAsync('INSERT INTO votes (post_id, eloRating, time) VALUES (?, ?, CURRENT_TIMESTAMP())', [
            winnerPostId,
            updatedEloRatingWinner
        ]);

        await queryAsync('INSERT INTO votes (post_id, eloRating, time) VALUES (?, ?, CURRENT_TIMESTAMP())', [
            loserPostId,
            updatedEloRatingLoser
        ]);

        // 7. ส่งคำตอบกลับ:
        res.json({
            message: 'Vote successfully recorded',
            updatedWinner,
            updatedEloRatingWinner: { oldRating: oldRatingWinner, newRating: updatedEloRatingWinner },
            updatedLoser,
            updatedEloRatingLoser: { oldRating: oldRatingLoser, newRating: updatedEloRatingLoser }
        });
    } catch (error) {
        // 8. จัดการข้อผิดพลาด:
        console.error('Error processing vote:', error);
        res.status(500).json({ error: 'Error processing vote' });
    }
});


// ฟังก์ชันทำ query ในฐานข้อมูล แบบ Promise:
async function queryAsync(query: string, params: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
        conn.query(query, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// ฟังก์ชันคำนวณ Elo Rating:
function calculateUpdatedEloRating(initialEloRating: number, opponentEloRating: number, isWinner: boolean): { updatedEloRating: number, oldRating: number } {
    const K = 32;
    const Ea = 1 / (1 + Math.pow(10, (opponentEloRating - initialEloRating) / 400));
    const Eb = 1 / (1 + Math.pow(10, (initialEloRating - opponentEloRating) / 400));

    const updatedEloRating = isWinner ? initialEloRating + K * (1 - Ea) : initialEloRating + K * (0 - Eb);

    return {
        updatedEloRating,
        oldRating: initialEloRating,
    };
}