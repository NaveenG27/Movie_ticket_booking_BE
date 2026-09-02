import { Router } from "express";
import {
  createScreen,
  getScreensByTheater,
  getScreenById,
  updateScreen,
  deleteScreen,
} from "./screen.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { createScreenSchema, updateScreenSchema } from "./screen.validation";

const router = Router({ mergeParams: true }); // mergeParams to access :theaterId

// Public: view screens for a theater
router.get("/", getScreensByTheater);
router.get("/:id", getScreenById);

// Theater owner/admin: create, update, delete
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(createScreenSchema),
  createScreen
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(updateScreenSchema),
  updateScreen
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  deleteScreen
);

export default router;
