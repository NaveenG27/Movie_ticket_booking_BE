import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

/**
 * Centralized error handler middleware.
 *
 * Response shape:
 *   {
 *     success: false,
 *     message: string,
 *     error?: object          // only in development
 *   }
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Operational errors (expected): use the status code we set
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && {
        error: { name: err.name, stack: err.stack },
      }),
    });
    return;
  }

  // Prisma-specific errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as any;
    if (prismaErr.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "A record with that value already exists",
      });
      return;
    }
    if (prismaErr.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Record not found",
      });
      return;
    }
  }

  // Programming / unexpected errors: log and return generic message
  console.error("💥 Unexpected error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      error: { name: err.name, message: err.message, stack: err.stack },
    }),
  });
}
