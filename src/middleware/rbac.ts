import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { JwtPayload } from "./auth";

/**
 * authorize — factory that returns middleware restricting access
 * to users whose role is in the allowed list.
 *
 * Usage:
 *   router.get("/admin-only", authenticate, authorize("ADMIN"), handler);
 *   router.get("/admin-or-owner", authenticate, authorize("ADMIN", "THEATER_OWNER"), handler);
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as JwtPayload | undefined;

    if (!user) {
      return next(AppError.unauthorized("Authentication required"));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(
        AppError.forbidden(
          `Role '${user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
}
