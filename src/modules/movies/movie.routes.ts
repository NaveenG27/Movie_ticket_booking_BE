import { Router } from "express";
import {
  createMovie,
  getMovies,
  getMovieById,
  updateMovie,
  deleteMovie,
} from "./movie.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { createMovieSchema, updateMovieSchema } from "./movie.validation";

const router = Router();

// Public: read
router.get("/", getMovies);
router.get("/:id", getMovieById);

// Admin only: write
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createMovieSchema),
  createMovie
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(updateMovieSchema),
  updateMovie
);

router.delete("/:id", authenticate, authorize("ADMIN"), deleteMovie);

export default router;
