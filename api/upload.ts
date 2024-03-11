// //upload.ts
// import express from "express";
// import path from "path";
// import multer from "multer";
// import { initializeApp } from "firebase/app";
// import { deleteObject, getStorage, list, ref, uploadBytes } from "@firebase/storage";
// import fs from 'fs';
// import { v4 as uuidv4 } from 'uuid';

// const firebaseConfig = {
//   apiKey: "AIzaSyDS6QsLlBnbp9W_8b-DgF-AUddJNqUd8fo",
//   authDomain: "node-express-mysql-982a1.firebaseapp.com",
//   projectId: "node-express-mysql-982a1",
//   storageBucket: "node-express-mysql-982a1.appspot.com",
//   messagingSenderId: "290288082757",
//   appId: "1:290288082757:web:6078d0a5acfa72a6d2282c",
//   measurementId: "G-V3BJ87LWF9"
// };

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);

// export const router = express.Router();

// class FileMiddleware {
//   filename = "";
//   public readonly diskLoader = multer({
//     storage: multer.memoryStorage(),
//     limits: {
//       fileSize: 67108864, // 64 MByte
//     },
//   });
// }

// let latestId = 0; // เก็บค่า ID ล่าสุด

// const fileUpload = new FileMiddleware();

// router.post("/", fileUpload.diskLoader.single("file"), async (req, res) => {
//   try {
//     // Check if req.file is defined
//     if (!req.file) {
//       res.status(400).json({ error: "File not found in request" });
//       return;
//     }

//     const fileBuffer = req.file.buffer;

//     const originalFileName = req.file.originalname;
//     latestId += 1; // เพิ่มค่า ID ทุกครั้งที่มีข้อมูลเข้ามา
//     const fileId = latestId.toString();

//     const localFilePath = path.join(__dirname, "../uploads", `${fileId}_${originalFileName}`);

//     // Save to local directory
//     await fs.promises.writeFile(localFilePath, fileBuffer);

//     // Save to Firebase Storage
//     const filePath = `/uploads/${fileId}_${originalFileName}`;
//     const storageRef = ref(storage, filePath);

//     await uploadBytes(storageRef, fileBuffer);

//     res.json({
//       id: fileId,
//       filename: filePath
//     });
//   } catch (error) {
//     console.error("Error uploading file:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// // Get /upload
// router.get("/", async (req, res) => {
//   try {
//     const storageRef = ref(storage, '/uploads');
//     const listResult = await list(storageRef);

//     const files = listResult.items.map((item, index) => {
//       const fileId = index + 1;
//       return {
//         id: fileId,
//         name: item.name,
//         fullPath: item.fullPath,
//         downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${storageRef.bucket}/o/${encodeURIComponent(item.fullPath)}?alt=media`,
//       };
//     });

//     res.json({ files });
//   } catch (error) {
//     console.error("Error getting files:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });
// // Delete /upload/:id
// router.delete("/:id", async (req, res) => {
//   try {
//     const fileId = req.params.id;

//     // Check if the ID is valid (numeric and within range)
//     const fileIdNumeric = parseInt(fileId, 10);
//     if (isNaN(fileIdNumeric) || fileIdNumeric <= 0 || fileIdNumeric > latestId) {
//       res.status(400).json({ error: "Invalid file ID" });
//       return;
//     }

//     const fileName = `${fileId}_`; // ตัด ID ออกจากชื่อไฟล์

//     // Delete from local directory
//     const localFilePath = path.join(__dirname, "../uploads");
//     const files = fs.readdirSync(localFilePath);
//     const fileToDelete = files.find(file => file.startsWith(fileName));
//     if (fileToDelete) {
//       const filePathToDelete = path.join(localFilePath, fileToDelete);
//       fs.unlinkSync(filePathToDelete);
//     }

//     // Delete from Firebase Storage
//     const filePath = `/uploads/${fileName}`;
//     const storageRef = ref(storage, filePath);
//     await deleteObject(storageRef);

//     res.json({ success: true, message: "File deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting file:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });