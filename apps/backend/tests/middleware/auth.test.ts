import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signToken } from "../../src/middleware/auth.js";
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
