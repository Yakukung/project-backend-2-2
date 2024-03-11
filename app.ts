import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { router as index } from "./api/index";
import { router as facemash } from "./api/facemash";
import { router as ranking } from "./api/facemash-ranking";

export const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "*", // or specify the allowed origin(s) explicitly
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // specify the allowed methods
    credentials: true, // enable credentials (if needed)
    optionsSuccessStatus: 204, // for preflight requests
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", index);
app.use("/facemash", facemash);
app.use("/facemash/ranking", ranking);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
