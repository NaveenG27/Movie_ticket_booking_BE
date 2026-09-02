import { Request, Response, NextFunction } from "express";
import * as showService from "./show.service";
import { JwtPayload } from "../../middleware/auth";

export async function createShow(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const show = await showService.createShow(req.body, user.userId, user.role);
    res.status(201).json({ success: true, message: "Show created", data: show });
  } catch (err) {
    next(err);
  }
}

export async function getShows(req: Request, res: Response, next: NextFunction) {
  try {
    const { movieId, city, date, theaterId } = req.query;
    const shows = await showService.getShows({
      movieId: movieId as string,
      city: city as string,
      date: date as string,
      theaterId: theaterId as string,
    });
    res.json({ success: true, data: shows });
  } catch (err) {
    next(err);
  }
}

export async function getShowById(req: Request, res: Response, next: NextFunction) {
  try {
    const show = await showService.getShowById(req.params.id);
    res.json({ success: true, data: show });
  } catch (err) {
    next(err);
  }
}

export async function getShowSeats(req: Request, res: Response, next: NextFunction) {
  try {
    const seats = await showService.getShowSeats(req.params.id);
    res.json({ success: true, data: seats });
  } catch (err) {
    next(err);
  }
}

export async function updateShow(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const show = await showService.updateShow(
      req.params.id,
      req.body,
      user.userId,
      user.role
    );
    res.json({ success: true, message: "Show updated", data: show });
  } catch (err) {
    next(err);
  }
}

export async function deleteShow(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    await showService.deleteShow(req.params.id, user.userId, user.role);
    res.json({ success: true, message: "Show deleted" });
  } catch (err) {
    next(err);
  }
}
