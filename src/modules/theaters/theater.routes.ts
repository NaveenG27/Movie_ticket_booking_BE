import { Router } from "express";
import {
  createTheater,
  getTheaters,
  getTheaterById,
  updateTheater,
  deleteTheater,
} from "./theater.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { createTheaterSchema, updateTheaterSchema } from "./theater.validation";

const router = Router();

// Public: list and view
router.get("/", getTheaters);
router.get("/:id", getTheaterById);

// Admin + Theater Owner: create
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(createTheaterSchema),
  createTheater
);

// Admin + Theater Owner (scoped): update
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  validate(updateTheaterSchema),
  updateTheater
);

// Admin + Theater Owner (scoped): delete
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "THEATER_OWNER"),
  deleteTheater
);

export default router;
