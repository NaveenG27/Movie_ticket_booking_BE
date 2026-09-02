import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerUser(req.body);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body);

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Expect token in body for refresh (or could use a refresh token cookie)
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required for token refresh",
      });
    }

    const result = await authService.refreshUserToken(userId);

    res.json({
      success: true,
      message: "Token refreshed",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
