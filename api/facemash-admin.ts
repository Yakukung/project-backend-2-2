import express from "express";
import { conn } from "../dbconnect";
import { Request, Response, Router } from "express";


export const router = express.Router();

router.get("/", (req: Request, res: Response) => {
    conn.query(
      `SELECT *
         FROM users
         WHERE user_type != 'admin';`,
         (err: any, result: any[]) => {
        if (err) {
          res.json(err);
        } else {
            res.json(result);
          }
        }
      );
    });
    