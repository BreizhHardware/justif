import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { requirePermission, signToken } from "../../src/middleware/auth.js";
import { TEST_JWT_SECRET } from "../test-env.js";

interface Payload {
  sub: string;
  iat: number;
  exp: number;
}

describe("signToken", () => {
  it("encodes the user id as sub", () => {
    const token = signToken("user_123");
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as Payload;
    expect(decoded.sub).toBe("user_123");
  });

  it("expires roughly 30 days from now", () => {
    const token = signToken("user_123");
    const decoded = jwt.decode(token) as Payload;
    const ttlDays = (decoded.exp - decoded.iat) / (60 * 60 * 24);
    expect(ttlDays).toBeCloseTo(30, 1);
  });
});

describe("requirePermission", () => {
  function mockRes() {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    return res as unknown as Response;
  }

  it("calls next() when the user holds the required permission", () => {
    const req = { user: { id: "u1", email: "a@b.com", roles: [], permissions: ["MANAGE_USERS"] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requirePermission("MANAGE_USERS")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks the required permission", () => {
    const req = { user: { id: "u1", email: "a@b.com", roles: [], permissions: [] } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requirePermission("MANAGE_USERS")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when req.user is undefined", () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    requirePermission("MANAGE_USERS")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
