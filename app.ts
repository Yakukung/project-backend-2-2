//app.ts
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
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/", index);
app.use("/facemash", facemash);
app.use("/facemash/ranking", ranking);


