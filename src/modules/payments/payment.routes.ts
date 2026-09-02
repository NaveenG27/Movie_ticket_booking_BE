import { Router } from "express";
import { mockPayment } from "./payment.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { mockPaymentSchema } from "./payment.validation";

const router = Router();

router.use(authenticate);
router.use(authorize("CUSTOMER", "ADMIN"));

router.post("/mock", validate(mockPaymentSchema), mockPayment);

export default router;
