import { Request, Response, NextFunction } from "express";
import * as paymentService from "./payment.service";
import { JwtPayload } from "../../middleware/auth";

export async function mockPayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const { bookingId, success } = req.body;

    const result = await paymentService.processMockPayment(
      bookingId,
      user.userId,
      success
    );

    res.json({
      success: result.success,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
