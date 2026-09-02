import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../utils/AppError";

/**
 * validate — factory that returns middleware which validates
 * the specified request property (body, query, params) against a Zod schema.
 *
 * Usage:
 *   router.post("/movies", validate(createMovieSchema, "body"), handler);
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      // Replace with parsed (coerced) data so downstream sees clean values
      req[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        next(AppError.badRequest(`Validation error: ${message}`));
      } else {
        next(err);
      }
    }
  };
}
