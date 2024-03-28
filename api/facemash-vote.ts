// facemash-vote.ts
import express from "express";
import { conn } from "../dbconnect";
import { Request, Response } from "express";
import { format } from 'date-fns';

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

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setUTCHours(startDate.getUTCHours() + 7);
    startDate.setDate(startDate.getDate());
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    endDate.setUTCHours(endDate.getUTCHours() + 7);
    endDate.setDate(endDate.getDate());
    
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    

  const existingVotes = await queryAsync(
    `SELECT * FROM votes WHERE time >= ? AND time <= ?`,
    [formattedStartDate, formattedEndDate]
  );
  console.log("Vote Start Date: ", formattedStartDate, "Vote End Date: ", formattedEndDate);
  


  if (existingVotes.length === 0) {
    const allPosts = await queryAsync(
      "SELECT post_id, score, newRank FROM posts",
      []
    );
    console.log(" existingVotes: ",  existingVotes); 

    for (const post of allPosts) {
      const { post_id, score, newRank } = post;
      // เปลี่ยนคำสั่ง SQL เพื่อใช้ CURRENT_TIMESTAMP() ตรงๆ และไม่ใช้ CURRENT_DATE()
      await queryAsync(
        "INSERT INTO votes (post_id, newRating, oldRating, newRank, time) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP())",
        [post_id, score, score, newRank]
      );
    }

  }
  else {
    // ถ้ามี votes ในวันนั้นแล้ว
    const newPosts = await queryAsync(
      "SELECT * FROM posts WHERE NOT EXISTS (SELECT * FROM votes WHERE votes.post_id = posts.post_id AND DATE(votes.time) >= ? AND DATE(votes.time) <= ?)",
      [formattedStartDate, formattedEndDate]
    );
    
    for (const newPost of newPosts) {
      const {score, newRank } = newPost;
      // เพิ่มเฉพาะ post_id ที่มาใหม่ในวันนั้น
      const existingVote = await queryAsync(
        "SELECT * FROM votes WHERE post_id = ? AND DATE(time) >= ? AND DATE(time) <= ?",
        [newPost.post_id, formattedStartDate, formattedEndDate]
      );

      if (existingVote.length === 0) {
        await queryAsync(
          "INSERT INTO votes (post_id, newRating, oldRating, newRank, time) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP())",
          [newPost.post_id, score, score, newRank] // สามารถกำหนดค่าใดๆ ที่ต้องการสำหรับ newRating, oldRating, และ newRank ได้ตามความเหมาะสม
        );
      }
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
      `Before update - Post-id: ${winnerPostId} ,Winner: ${selectedWinner.score},/ Post-id: ${winnerPostId}, Loser: ${selectedLoser.score}`
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
      `After update -  Post-id: ${loserPostId}, Winner: ${updatedEloRatingWinner},/ Post-id: ${loserPostId}, Loser: ${updatedEloRatingLoser}`
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

// 6. อัปเดตอันดับของโพสต์ในตาราง "votes" และ "posts"
const allPostsScores = await queryAsync(
  "SELECT post_id, score FROM posts",
  []
);

// เรียงลำดับโพสต์ตามคะแนนจากมากไปน้อย
const allPostsOrdered = allPostsScores.sort((a, b) => b.score - a.score);

// อัปเดตแรงค์สำหรับทุกโพสต์ในวันปัจจุบัน
for (let i = 0; i < allPostsOrdered.length; i++) {
  const postId = allPostsOrdered[i].post_id;
  const rank = i + 1;

  // อัปเดตแรงค์ในตาราง "votes"
  await queryAsync(
    "UPDATE votes SET newRank = ? WHERE post_id = ? AND DATE(time) = CURRENT_DATE()",
    [rank, postId]
  );
}
// ดึง rank จากตาราง "votes"
const votesRank = await queryAsync(
  "SELECT post_id, newRank, newRating FROM votes WHERE DATE(time) = CURRENT_DATE()",[]
);

// อัปเดตแรงค์ในตาราง "posts" โดยใช้ข้อมูลจากตาราง "votes"
for (const vote of votesRank) {
  const postId = vote.post_id;
  const rank = vote.newRank;
  const score = vote.newRating;
  // อัปเดตแรงค์ในตาราง "posts"
  await queryAsync(
    "UPDATE posts SET newRank = ?, score = ?  WHERE post_id = ?",
    [rank, score, postId]
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
