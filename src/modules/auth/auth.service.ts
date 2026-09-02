import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";
import { RegisterInput, LoginInput } from "./auth.validation";

const SALT_ROUNDS = 12;

// ─── Token helpers ─────────────────────────────────────────

export function generateToken(payload: {
  userId: string;
  role: string;
}): string {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  if (!secret) throw AppError.internal("JWT_SECRET not configured");

  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    secret,
    { expiresIn } as jwt.SignOptions
  );
}

// ─── Register ──────────────────────────────────────────────

export async function registerUser(input: RegisterInput) {
  const { name, email, password, role } = input;

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const token = generateToken({ userId: user.id, role: user.role });

  return { user, token };
}

// ─── Login ─────────────────────────────────────────────────

export async function loginUser(input: LoginInput) {
  const { email, password } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const token = generateToken({ userId: user.id, role: user.role });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
}

// ─── Refresh Token ─────────────────────────────────────────

export async function refreshUserToken(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const token = generateToken({ userId: user.id, role: user.role });

  return { token };
}
