import { Router } from "express";
import {
  createShow,
  getShows,
  getShowById,
  getShowSeats,
  updateShow,
  deleteShow,
} from "./show.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { createShowSchema, updateShowSchema } from "./show.validation";

const router = Router();

// Public: browse shows
router.get("/", getShows);
router.get("/:id", getShowById);
router.get("/:id/seats", getShowSeats);

// Theater owner/admin: manage
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(createShowSchema),
  createShow
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(updateShowSchema),
  updateShow
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  deleteShow
);

export default router;
