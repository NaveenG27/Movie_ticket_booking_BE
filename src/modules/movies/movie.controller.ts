import { Request, Response, NextFunction } from "express";
import * as movieService from "./movie.service";

export async function createMovie(req: Request, res: Response, next: NextFunction) {
  try {
    const movie = await movieService.createMovie(req.body);
    res.status(201).json({ success: true, message: "Movie created", data: movie });
  } catch (err) {
    next(err);
  }
}

export async function getMovies(req: Request, res: Response, next: NextFunction) {
  try {
    const { language, genre, search } = req.query;
    const movies = await movieService.getMovies({
      language: language as string,
      genre: genre as string,
      search: search as string,
    });
    res.json({ success: true, data: movies });
  } catch (err) {
    next(err);
  }
}

export async function getMovieById(req: Request, res: Response, next: NextFunction) {
  try {
    const movie = await movieService.getMovieById(req.params.id);
    res.json({ success: true, data: movie });
  } catch (err) {
    next(err);
  }
}

export async function updateMovie(req: Request, res: Response, next: NextFunction) {
  try {
    const movie = await movieService.updateMovie(req.params.id, req.body);
    res.json({ success: true, message: "Movie updated", data: movie });
  } catch (err) {
    next(err);
  }
}

export async function deleteMovie(req: Request, res: Response, next: NextFunction) {
  try {
    await movieService.deleteMovie(req.params.id);
    res.json({ success: true, message: "Movie deleted" });
  } catch (err) {
    next(err);
  }
}
