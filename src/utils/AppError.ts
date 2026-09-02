/**
 * Custom error class for operational (expected) errors.
 * Non-operational errors (programming bugs) are treated differently
 * by the global error handler.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message = "Bad request") {
    return new AppError(message, 400);
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }

  static notFound(message = "Resource not found") {
    return new AppError(message, 404);
  }

  static conflict(message = "Resource already exists") {
    return new AppError(message, 409);
  }

  static internal(message = "Internal server error") {
    return new AppError(message, 500);
  }
}
