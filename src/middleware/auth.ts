import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "THEATER_OWNER" | "CUSTOMER";
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * authenticate — verifies the JWT from the Authorization header
 * and attaches the decoded payload to req.user.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.unauthorized("Missing or malformed Authorization header");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw AppError.unauthorized("No token provided");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw AppError.internal("JWT_SECRET not configured");
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (err: any) {
    if (err instanceof AppError) {
      next(err);
    } else if (err.name === "JsonWebTokenError") {
      next(AppError.unauthorized("Invalid token"));
    } else if (err.name === "TokenExpiredError") {
      next(AppError.unauthorized("Token expired"));
    } else {
      next(err);
    }
  }
}
