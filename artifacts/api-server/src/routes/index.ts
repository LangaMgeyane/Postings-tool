import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postingsRouter from "./postings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/postings", postingsRouter);

export default router;
