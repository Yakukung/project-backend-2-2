//index.ts
import express from "express";
// import { router as uploadRouter } from "./upload";

export const router = express.Router();

router.get('/', (req, res)=>{
    res.send('Get in index.ts');
});