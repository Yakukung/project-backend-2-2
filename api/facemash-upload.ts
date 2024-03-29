//upload.ts
import express from "express";
import path from "path";
import multer from "multer";
import { initializeApp } from "firebase/app";
import {
  deleteObject,
  getStorage,
  list,
  ref,
  uploadBytes,
} from "@firebase/storage";
import fs from "fs";
import {
  getMetadata as getStorageMetadata,
  FullMetadata,
} from "@firebase/storage";
import { conn, mysql, queryAsync } from "../dbconnect";
import { v4 as uuid } from 'uuid';

const firebaseConfig = {
  apiKey: "AIzaSyCTHkImD_Lp8UFWaZe3--7JXVJ6VyTS8zk",
  authDomain: "project-web-2-2-8e86b.firebaseapp.com",
  projectId: "project-web-2-2",
  storageBucket: "project-web-2-2.appspot.com",
  messagingSenderId: "981012919708",
  appId: "1:981012919708:web:7eebe439eeeb6c8230c459",
  measurementId: "G-C84TN56QSD",
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

export const router = express.Router();

class FileMiddleware {
  filename = "";
  public readonly diskLoader = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 67108864, // 64 MByte
    },
    fileFilter: (req, file, callback) => {
      const allowedMimes = ["image/jpeg", "image/png"];

      if (allowedMimes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(
          new Error("Invalid file type. Only JPEG and PNG are allowed.")
        );
      }
    },
  });
}

let latestId = 0; // เก็บค่า ID ล่าสุด

const fileUpload = new FileMiddleware();

router.get("/", async (req, res) => {
  try {
    const storageRef = ref(storage, "/assets/img");
    const listResult = await list(storageRef);

    const files = [];

    // Iterate through subdirectories (first_name)
    for (const first_nameDir of listResult.prefixes) {
      const firstNameRef = ref(storage, first_nameDir.fullPath);
      const firstNameListResult = await list(firstNameRef);

      // Iterate through subdirectories (posts) inside each first_name directory
      for (const postDir of firstNameListResult.prefixes) {
        const postRef = ref(storage, postDir.fullPath);
        const postListResult = await list(postRef);

        // Iterate through files in the post directory
        const postFiles = postListResult.items.map((item, index) => {
          const fileId = index + 1;
          return {
            id: fileId,
            name: item.name,
            fullPath: item.fullPath,
            downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${
              storageRef.bucket
            }/o/${encodeURIComponent(item.fullPath)}?alt=media`,
          };
        });

        files.push({
          first_name: first_nameDir.name,
          folder: postDir.name,
          [postDir.name]: postFiles,
        });
      }
    }

    res.json({ files });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/show-data-img", async (req, res) => {
  try {
    const storageRef = ref(storage, "/assets/img");
    const listResult = await list(storageRef);

    const files = [];
    const { first_name } = req.body;

    // Iterate through subdirectories (first_name)
    for (const first_nameDir of listResult.prefixes) {
      const firstNameRef = ref(storage, first_nameDir.fullPath);
      const firstNameListResult = await list(firstNameRef);

      // Check if first_name directory belongs to the requested user_id
      if (first_nameDir.name === first_name) {
        // Iterate through subdirectories (posts) inside each first_name directory
        for (const postDir of firstNameListResult.prefixes) {
          const postRef = ref(storage, postDir.fullPath);
          const postListResult = await list(postRef);

          // Iterate through files in the post directory
          const postFiles = postListResult.items.map((item, index) => {
            const fileId = index + 1;
            return {
              id: fileId,
              name: item.name,
              fullPath: item.fullPath,
              downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${
                storageRef.bucket
              }/o/${encodeURIComponent(item.fullPath)}?alt=media`,
            };
          });

          files.push({
            first_name: first_nameDir.name,
            folder: postDir.name,
            [postDir.name]: postFiles,
          });
        }
      }
    }

    res.json({ files });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", fileUpload.diskLoader.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File not found in request" });
      return;
    }

    const fileBuffer = req.file.buffer;

    const { first_name, user_id } = req.body;

    if (!first_name || !user_id) {
      res.status(400).json({ error: "Missing required information" });
      return;
    }

    const originalFileName = req.file.originalname;
    const fileId: string = uuid(); // สร้างชื่อไฟล์แบบสุ่ม
    const fileExtension: string = path.extname(originalFileName); // ดึงนามสกุลของไฟล์
    const newFileName: string = `${fileId}${fileExtension}`; // กำหนดชื่อไฟล์ใหม่
    latestId += 1;

    const filePath = `/assets/img/${first_name}/post/${newFileName}`;
    const localFilePath = path.join(__dirname, `..${filePath}`);

    const directoryPath = path.dirname(localFilePath);
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    await fs.promises.writeFile(localFilePath, fileBuffer);

    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, fileBuffer);

    // Construct the URL for the uploaded image without leading %2F
    const fileDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${
      storageRef.bucket
    }/o/${encodeURIComponent(filePath).replace("%2F", "")}?alt=media`;

    // Insert a new record into the "posts" table
    conn.query(
      "INSERT INTO posts (user_id, picture, score) VALUES (?, ?, 600)",
      [user_id, fileDownloadUrl],
      (error, results) => {
        if (error) {
          console.error("Error inserting into database:", error);
          res.status(500).json({ error: "Internal Server Error" });
        } else {
          res.json({
            id: latestId.toString(),
            filename: filePath,
            first_name: first_name,
            user_id: user_id,
            picture: fileDownloadUrl,
          });
        }
      }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/icon", fileUpload.diskLoader.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File not found in request" });
      return;
    }

    const fileBuffer = req.file.buffer;

    const { first_name, user_id } = req.body;

    if (!first_name || !user_id) {
      res.status(400).json({ error: "Missing required information" });
      return;
    }

    const originalFileName = req.file.originalname;
    const fileId: string = uuid(); // สร้างชื่อไฟล์แบบสุ่ม
    const fileExtension: string = path.extname(originalFileName); // ดึงนามสกุลของไฟล์
    const newFileName: string = `${fileId}${fileExtension}`; // กำหนดชื่อไฟล์ใหม่
    
    latestId += 1;

    const filePath = `/assets/img/${first_name}/icon/${newFileName}`;
    const localFilePath = path.join(__dirname, `..${filePath}`);

    const directoryPath = path.dirname(localFilePath);
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    await fs.promises.writeFile(localFilePath, fileBuffer);

    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, fileBuffer);

    // Construct the URL for the uploaded image without leading %2F
    const fileDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${
      storageRef.bucket
    }/o/${encodeURIComponent(filePath).replace("%2F", "")}?alt=media`;

    // Insert a new record into the "posts" table
    conn.query(
      "UPDATE users SET icon = ? WHERE user_id = ?",
      [fileDownloadUrl, user_id],
      (error, results) => {
        if (error) {
          console.error("Error inserting into database:", error);
          res.status(500).json({ error: "Internal Server Error" });
        } else {
          res.json({
            id: latestId.toString(),
            filename: filePath,
            first_name: first_name,
            user_id: user_id,
            icon: fileDownloadUrl,
          });
        }
      }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/banner",
  fileUpload.diskLoader.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "File not found in request" });
        return;
      }

      const fileBuffer = req.file.buffer;

      const { first_name, user_id } = req.body;

      if (!first_name || !user_id) {
        res.status(400).json({ error: "Missing required information" });
        return;
      }

      const originalFileName = req.file.originalname;
      const fileId: string = uuid(); // สร้างชื่อไฟล์แบบสุ่ม
      const fileExtension: string = path.extname(originalFileName); // ดึงนามสกุลของไฟล์
      const newFileName: string = `${fileId}${fileExtension}`; // กำหนดชื่อไฟล์ใหม่
      latestId += 1;

      const filePath = `/assets/img/${first_name}/banner/${newFileName}`;
      const localFilePath = path.join(__dirname, `..${filePath}`);

      const directoryPath = path.dirname(localFilePath);
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      await fs.promises.writeFile(localFilePath, fileBuffer);

      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, fileBuffer);

      // Construct the URL for the uploaded image without leading %2F
      const fileDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${
        storageRef.bucket
      }/o/${encodeURIComponent(filePath).replace("%2F", "")}?alt=media`;

      // Insert a new record into the "posts" table
      conn.query(
        "UPDATE users SET banner = ? WHERE user_id = ?",
        [fileDownloadUrl, user_id],
        (error, results) => {
          if (error) {
            console.error("Error inserting into database:", error);
            res.status(500).json({ error: "Internal Server Error" });
          } else {
            res.json({
              id: latestId.toString(),
              filename: filePath,
              first_name: first_name,
              user_id: user_id,
              banner: fileDownloadUrl,
            });
          }
        }
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);


router.put("/firstname", (req, res) => {
  const { first_name, user_id } = req.body;
  let sql = "UPDATE users SET first_name = ? WHERE user_id = ?";
  sql = mysql.format(sql, [first_name, user_id]);
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error updating firstname: ", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});

router.put("/lastname", (req, res) => {
  const { last_name, user_id } = req.body;
  let sql = "UPDATE users SET last_name = ? WHERE user_id = ?";
  sql = mysql.format(sql, [last_name, user_id]);
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error updating firstname: ", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});

router.put("/email", (req, res) => {
  const { email, user_id } = req.body;
  let sql = "UPDATE users SET email = ? WHERE user_id = ?";
  sql = mysql.format(sql, [email, user_id]);
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error updating firstname: ", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});

router.put("/password", (req, res) => {
  const { password, user_id } = req.body;
  let sql = "UPDATE users SET password = ? WHERE user_id = ?";
  sql = mysql.format(sql, [password, user_id]);
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error updating firstname: ", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});

router.put("/about", (req, res) => {
  const { about, user_id } = req.body;
  let sql = "UPDATE users SET about = ? WHERE user_id = ?";
  sql = mysql.format(sql, [about, user_id]);
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error updating firstname: ", err);
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});

router.delete("/delete-icon", async (req, res) => {
  const { user_id } = req.query;

  const getPostQuery = `SELECT first_name, icon FROM users WHERE user_id = ${user_id}`;
  const [users]: any = await queryAsync(getPostQuery);

  const DeleteIcon = `UPDATE users SET icon = NULL WHERE user_id = ${user_id}`;
  await queryAsync(DeleteIcon);

  const filePath = users.icon;
  await deleteObject(ref(storage, filePath));

  res
    .status(200)
    .json({ message: "Post and associated image deleted successfully" });
});

router.delete("/delete-banner", async (req, res) => {
  const { user_id } = req.query;

  const getPostQuery = `SELECT first_name, banner FROM users WHERE user_id = ${user_id}`;

  const [users]: any = await queryAsync(getPostQuery);

  const DeleteBanner = `UPDATE users SET banner = NULL WHERE user_id = ${user_id}`;
  await queryAsync(DeleteBanner);

  const filePath = users.banner;

  await deleteObject(ref(storage, filePath));

  res
    .status(200)
    .json({ message: "Post and associated image deleted successfully" });
});

router.delete("/delete-post", async (req, res) => {
  const { post_id } = req.query;

  try {
    if (!post_id) {
      return res.status(400).json({ error: "Post ID is missing" });
    }
    // ดึงข้อมูลรายละเอียดของ post จากฐานข้อมูล
    const getPostQuery = `SELECT users.first_name, posts.* FROM posts JOIN users ON posts.user_id = users.user_id WHERE posts.post_id = ${post_id}`;

    const [post]: any = await queryAsync(getPostQuery);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // ลบรายการ post ในฐานข้อมูล
    const deletePostQuery = `DELETE FROM posts WHERE post_id = ${post_id}`;
    await queryAsync(deletePostQuery);

    // กำหนด path ของไฟล์ใน Firebase Storage โดยใช้ path จากคอลัมน์ picture
    const filePath = post.picture;

    // ลบไฟล์ภาพใน Firebase Storage
    await deleteObject(ref(storage, filePath));

    res
      .status(200)
      .json({ message: "Post and associated image deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// router.get("/", async (req, res) => {
//   try {
//     const storageRef = ref(storage, '/uploads/img');
//     const listResult = await list(storageRef);

//     const files = [];

//     // Iterate through subdirectories (first_name)
//     for (const first_nameDir of listResult.prefixes) {
//       const firstNameRef = ref(storage, first_nameDir.fullPath);
//       const firstNameListResult = await list(firstNameRef);

//       // Iterate through subdirectories (posts) inside each first_name directory
//       for (const postDir of firstNameListResult.prefixes) {
//         const postRef = ref(storage, postDir.fullPath);
//         const postListResult = await list(postRef);

//         // Iterate through files in the post directory
//         const postFiles = postListResult.items.map((item, index) => {
//           const fileId = index + 1;
//           return {
//             id: fileId,
//             name: item.name,
//             fullPath: item.fullPath,
//             downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${storageRef.bucket}/o/${encodeURIComponent(item.fullPath)}?alt=media`,
//           };
//         });

//         files.push({ first_name: first_nameDir.name, post: postDir.name, files: postFiles });
//       }
//     }

//     res.json({ files });
//   } catch (error) {
//     console.error("Error getting files:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });
