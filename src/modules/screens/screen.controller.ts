import { Request, Response, NextFunction } from "express";
import * as screenService from "./screen.service";
import { JwtPayload } from "../../middleware/auth";

export async function createScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const { theaterId } = req.params;

    const screen = await screenService.createScreen(
      theaterId,
      { name: req.body.name, totalSeats: req.body.totalSeats },
      user.userId,
      user.role
    );

    res.status(201).json({ success: true, message: "Screen created", data: screen });
  } catch (err) {
    next(err);
  }
}

export async function getScreensByTheater(req: Request, res: Response, next: NextFunction) {
  try {
    const screens = await screenService.getScreensByTheater(req.params.theaterId);
    res.json({ success: true, data: screens });
  } catch (err) {
    next(err);
  }
}

export async function getScreenById(req: Request, res: Response, next: NextFunction) {
  try {
    const screen = await screenService.getScreenById(req.params.id);
    res.json({ success: true, data: screen });
  } catch (err) {
    next(err);
  }
}

export async function updateScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const screen = await screenService.updateScreen(
      req.params.id,
      req.body,
      user.userId,
      user.role
    );
    res.json({ success: true, message: "Screen updated", data: screen });
  } catch (err) {
    next(err);
  }
}

export async function deleteScreen(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    await screenService.deleteScreen(req.params.id, user.userId, user.role);
    res.json({ success: true, message: "Screen deleted" });
  } catch (err) {
    next(err);
  }
}
