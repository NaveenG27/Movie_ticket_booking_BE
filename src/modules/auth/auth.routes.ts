import { Router } from "express";
import { register, login, refreshToken } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { registerSchema, loginSchema } from "./auth.validation";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refreshToken);

export default router;
