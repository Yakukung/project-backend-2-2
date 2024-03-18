// facemash-vote.ts
import express from "express";
import { conn } from "../dbconnect";
import { Request, Response, Router } from "express";

export const router = express.Router();

router.get("/", (req, res) => {
  conn.query(
    "SELECT * FROM posts INNER JOIN users ON posts.user_id = users.user_id;",
    (err, result, fields) => {
      if (err) {
        res.json(err);
      } else {
        const randomIndexes: number[] = [];

        while (randomIndexes.length < 2) {
          const randomIndex = Math.floor(Math.random() * result.length);

          const previousIndex = randomIndexes[randomIndexes.length - 1];
          const selectedUserId = result[randomIndex].user_id;
          const previousUserId =
            previousIndex !== undefined
              ? result[previousIndex].user_id
              : undefined;

          if (previousUserId !== selectedUserId) {
            randomIndexes.push(randomIndex);
          }
        }

        const randomImages = randomIndexes.map((index) => result[index]);
        res.json(randomImages);
      }
    }
  );
});
router.post("/", async (req: Request, res: Response) => {
  try {
    const { winnerPostId, loserPostId } = req.body;

    // 6. เริ่มวันใหม่: ตรวจสอบว่ามีข้อมูลใน votes ของวันใหม่หรือไม่ ถ้าไม่มีให้เพิ่มข้อมูลทุก post_id จากตาราง posts เข้าไปใน votes
    const currentDate = new Date().toISOString().slice(0, 10); // ดึงวันที่ปัจจุบัน
    // const currentDate = new Date('2024-03-19')

    const existingVotes = await queryAsync(
      "SELECT * FROM votes WHERE DATE(time) = ?",
      [currentDate]
    );
    if (existingVotes.length === 0) {
      const allPosts = await queryAsync(
        "SELECT post_id, score, newRank FROM posts",
        []
      );
      for (const post of allPosts) {
        const { post_id, score, newRank } = post;

        await queryAsync(
          "INSERT INTO votes (post_id, newRating, oldRating, newRank, time) VALUES (?, ?, ?, ?, ?)",
          [post_id, score, score, newRank, currentDate]
        );
      }
    }

    // 2. ตรวจสอบโพสต์ผู้ชนะและผู้แพ้:
    const [selectedWinner] = await queryAsync(
      "SELECT * FROM posts WHERE post_id = ?",
      [winnerPostId]
    );
    const [selectedLoser] = await queryAsync(
      "SELECT * FROM posts WHERE post_id = ?",
      [loserPostId]
    );

    if (!selectedWinner || !selectedLoser) {
      return res.status(404).json({ error: "Winner or loser post not found" });
    }

    // 3. คำนวณ Elo Rating:
    const opponentEloRatingWinner = selectedWinner.score;
    const opponentEloRatingLoser = selectedLoser.score;

    const {
      updatedEloRating: updatedEloRatingWinner,
      oldRating: oldRatingWinner,
    } = calculateUpdatedEloRating(
      selectedWinner.score,
      opponentEloRatingLoser,
      true
    );

    const {
      updatedEloRating: updatedEloRatingLoser,
      oldRating: oldRatingLoser,
    } = calculateUpdatedEloRating(
      selectedLoser.score,
      opponentEloRatingWinner,
      false // ต้องแน่ใจว่า isWinner ถูกตั้งค่าเป็น false เมื่อเรียกใช้สำหรับผู้แพ้
    );

    // 4. อัปเดต Elo Rating และคะแนนในฐานข้อมูล:
    console.log(
      `Before update - Winner: ${selectedWinner.score}, Loser: ${selectedLoser.score}`
    );

    await queryAsync("UPDATE posts SET score = ? WHERE post_id = ?", [
      updatedEloRatingWinner,
      winnerPostId,
    ]);
    await queryAsync("UPDATE posts SET score = ? WHERE post_id = ?", [
      updatedEloRatingLoser,
      loserPostId,
    ]);

    console.log(
      `After update - Winner: ${updatedEloRatingWinner}, Loser: ${updatedEloRatingLoser}`
    );

    // 5. ดึงข้อมูลโพสต์ที่อัปเดต:
    const [updatedWinner] = await queryAsync(
      "SELECT * FROM posts WHERE post_id = ?",
      [winnerPostId]
    );
    const [updatedLoser] = await queryAsync(
      "SELECT * FROM posts WHERE post_id = ?",
      [loserPostId]
    );

    // Update data for loser
    await queryAsync(
      "UPDATE votes SET newRating = ?, oldRating = ?, time = CURRENT_TIMESTAMP() WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
      [updatedEloRatingLoser, oldRatingLoser, loserPostId]
    );

    // Update data for winner
    await queryAsync(
      "UPDATE votes SET newRating = ?, oldRating = ?, time = CURRENT_TIMESTAMP() WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
      [updatedEloRatingWinner, oldRatingWinner, winnerPostId]
    );

    // 6. อัปเดตอันดับของโพสต์ในตาราง "votes"
    const allPostsScores = await queryAsync(
      "SELECT post_id, score FROM posts",
      []
    );
    const allPostsOrdered = allPostsScores.sort((a, b) => b.score - a.score);
    // Update data for votes and posts with current date
    for (let i = 0; i < allPostsOrdered.length; i++) {
      const postId = allPostsOrdered[i].post_id;
      const rank = i + 1;

      // Update vote_id และ posts เฉพาะในวันปัจจุบันเท่านั้น
      await queryAsync(
        "UPDATE votes SET newRank = ? WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
        [rank, postId]
      );
      await queryAsync(
        "UPDATE posts SET newRank = ? WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
        [rank, postId]
      );
    }

    // Update old ratings in the votes table for the winner and loser with the current date
    await queryAsync(
      "UPDATE votes SET oldRating = ? WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
      [oldRatingWinner, winnerPostId]
    );
    await queryAsync(
      "UPDATE votes SET oldRating = ? WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
      [oldRatingLoser, loserPostId]
    );

    res.json({
      message: "Vote successfully recorded",
      updatedWinner,
      updatedEloRatingWinner: {
        oldRating: oldRatingWinner,
        newRating: updatedEloRatingWinner,
      },
      updatedLoser,
      updatedEloRatingLoser: {
        oldRating: oldRatingLoser,
        newRating: updatedEloRatingLoser,
      },
    });
  } catch (error) {
    console.error("Error processing vote:", error);
    res.status(500).json({ error: "Error processing vote" });
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

function calculateUpdatedEloRating(
  initialEloRating: number,
  opponentEloRating: number,
  isWinner: boolean
): { updatedEloRating: number; oldRating: number } {
  const K = 32;
  const Ea = 1 / (1 + Math.exp(-(opponentEloRating - initialEloRating) / 400));
  const Eb = 1 / (1 + Math.exp(-(initialEloRating - opponentEloRating) / 400));

  console.log("Ea: ", Ea);
  console.log("Eb: ", Eb);

  // เก็บค่าเดิมของ Elo rating
  const oldRating = initialEloRating;

  // คำนวณ Elo rating ใหม่
  const updatedEloRating = isWinner
    ? initialEloRating + K * (1 - Ea)
    : initialEloRating - K * Eb;

  return {
    updatedEloRating,
    oldRating,
  };
}

function calculateNewRating(score: any) {
  throw new Error("Function not implemented.");
}
