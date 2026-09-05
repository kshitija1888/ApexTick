import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getStockDetail,
} from "../controllers/watchlist";
import { heartbeat } from "../controllers/user";

const router = Router();
router.use(auth);

router.get("/watchlist", getWatchlist);
router.get("/watchlist/:ticker/detail", getStockDetail);
router.post("/watchlist", addToWatchlist);
router.delete("/watchlist/:ticker", removeFromWatchlist);

router.post("/user/heartbeat", heartbeat);

export default router;
