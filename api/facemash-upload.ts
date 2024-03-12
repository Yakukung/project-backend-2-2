//upload.ts
import express from "express";
import path from "path";
import multer from "multer";
import { initializeApp } from "firebase/app";
import { deleteObject, getStorage, list, ref, uploadBytes } from "@firebase/storage";
import fs from 'fs';
import { getMetadata as getStorageMetadata, FullMetadata } from "@firebase/storage";
import { conn, queryAsync } from "../dbconnect";


const firebaseConfig = {
  apiKey: "AIzaSyCTHkImD_Lp8UFWaZe3--7JXVJ6VyTS8zk",
  authDomain: "project-web-2-2-8e86b.firebaseapp.com",
  projectId: "project-web-2-2",
  storageBucket: "project-web-2-2.appspot.com",
  messagingSenderId: "981012919708",
  appId: "1:981012919708:web:7eebe439eeeb6c8230c459",
  measurementId: "G-C84TN56QSD"
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
        callback(new Error("Invalid file type. Only JPEG and PNG are allowed."));
      }
    },
  });
}


let latestId = 0; // เก็บค่า ID ล่าสุด

const fileUpload = new FileMiddleware();





router.post("/", fileUpload.diskLoader.single("file"), async (req, res) => {
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
    latestId += 1;

    const filePath = `/uploads/img/${first_name}/post/${originalFileName}`;
    const localFilePath = path.join(__dirname, `..${filePath}`);

    const directoryPath = path.dirname(localFilePath);
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    await fs.promises.writeFile(localFilePath, fileBuffer);

    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, fileBuffer);

    // Construct the URL for the uploaded image without leading %2F
    const fileDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageRef.bucket}/o/${encodeURIComponent(filePath).replace('%2F', '')}?alt=media`;

    // Insert a new record into the "posts" table
    conn.query(
      'INSERT INTO posts (user_id, picture) VALUES (?, ?)',
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




router.get("/", async (req, res) => {
  try {
    const storageRef = ref(storage, '/assets/img');
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
            downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${storageRef.bucket}/o/${encodeURIComponent(item.fullPath)}?alt=media`,
          };
        });

        files.push({ first_name: first_nameDir.name, folder: postDir.name, [postDir.name]: postFiles });
      }
    }

    res.json({ files });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

