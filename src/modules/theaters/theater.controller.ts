import { Request, Response, NextFunction } from "express";
import * as theaterService from "./theater.service";
import { JwtPayload } from "../../middleware/auth";

export async function createTheater(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    // If user is a theater owner, auto-assign as owner
    // If admin, they can specify ownerId in the body, otherwise use their own id
    const ownerId =
      req.body.ownerId && user.role === "ADMIN"
        ? req.body.ownerId
        : user.userId;

    const theater = await theaterService.createTheater(
      { name: req.body.name, city: req.body.city },
      ownerId
    );

    res.status(201).json({ success: true, message: "Theater created", data: theater });
  } catch (err) {
    next(err);
  }
}

export async function getTheaters(req: Request, res: Response, next: NextFunction) {
  try {
    const { city } = req.query;
    const theaters = await theaterService.getTheaters({
      city: city as string,
    });
    res.json({ success: true, data: theaters });
  } catch (err) {
    next(err);
  }
}

export async function getTheaterById(req: Request, res: Response, next: NextFunction) {
  try {
    const theater = await theaterService.getTheaterById(req.params.id);
    res.json({ success: true, data: theater });
  } catch (err) {
    next(err);
  }
}

export async function updateTheater(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const theater = await theaterService.updateTheater(
      req.params.id,
      req.body,
      user.userId,
      user.role
    );
    res.json({ success: true, message: "Theater updated", data: theater });
  } catch (err) {
    next(err);
  }
}

export async function deleteTheater(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    await theaterService.deleteTheater(
      req.params.id,
      user.userId,
      user.role
    );
    res.json({ success: true, message: "Theater deleted" });
  } catch (err) {
    next(err);
  }
}
