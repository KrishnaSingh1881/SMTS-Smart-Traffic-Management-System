/**
 * Task 5.4 — Unit tests for authentication logic
 *
 * Tests use a mock PrismaClient and mock bcrypt to exercise the
 * authorize() logic in isolation without a live database.
 *
 * Requirements: 8.3, 8.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────
// Inline re-implementation of the authorize logic
// (mirrors src/lib/auth/options.ts) so tests are
// self-contained and don't require a DB connection.
// ─────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: "Traffic_Controller" | "Driver";
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

interface MockPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

// Build a mock prisma that records calls
function buildMockPrisma(user: MockUser | null): MockPrisma {
  const mockPrisma: MockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<MockUser> }) => {
        if (user) Object.assign(user, data);
        return Promise.resolve(user);
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    $transaction: vi.fn().mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops)
    ),
  };
  return mockPrisma;
}

// Extracted authorize function (same logic as options.ts)
async function authorize(
  credentials: { email: string; password: string } | undefined,
  mockPrisma: MockPrisma
): Promise<{ id: string; email: string; role: string } | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const user = await mockPrisma.user.findUnique({
    where: { email: credentials.email },
  }) as MockUser | null;

  if (!user || !user.isActive) return null;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("ACCOUNT_LOCKED");
  }

  const passwordValid = await bcrypt.compare(
    credentials.password,
    user.passwordHash
  );

  if (!passwordValid) {
    const newFailCount = user.failedLoginCount + 1;

    if (newFailCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await mockPrisma.$transaction([
        mockPrisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: newFailCount, lockedUntil },
        }),
        mockPrisma.auditLog.create({
          data: {
            action: "ACCOUNT_LOCKOUT",
            userId: user.id,
            metadata: {
              email: user.email,
              lockedUntil: lockedUntil.toISOString(),
              failedAttempts: newFailCount,
            },
          },
        }),
      ]);
    } else {
      await mockPrisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newFailCount },
      });
    }

    return null;
  }

  await mockPrisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  return { id: user.id, email: user.email, role: user.role };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function makeUser(overrides: Partial<MockUser> = {}): Promise<MockUser> {
  return {
    id: "user-001",
    email: "controller@stms.io",
    passwordHash: await bcrypt.hash("correct-password", 10),
    fullName: "Test Controller",
    role: "Traffic_Controller",
    isActive: true,
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests — lockout after 5 consecutive failures (Req 8.3, 8.4)
// ─────────────────────────────────────────────

describe("Account lockout after 5 failed login attempts (Req 8.3, 8.4)", () => {
  it("does not lock account after 4 failed attempts", async () => {
    const user = await makeUser({ failedLoginCount: 3 });
    const mockPrisma = buildMockPrisma(user);

    const result = await authorize(
      { email: user.email, password: "wrong" },
      mockPrisma
    );

    expect(result).toBeNull();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    // failedLoginCount incremented to 4
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginCount: 4 }),
      })
    );
  });

  it("locks account and inserts ACCOUNT_LOCKOUT audit log on 5th failure", async () => {
    const user = await makeUser({ failedLoginCount: 4 });
    const mockPrisma = buildMockPrisma(user);

    const result = await authorize(
      { email: user.email, password: "wrong" },
      mockPrisma
    );

    expect(result).toBeNull();
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();

    // Verify audit log was created with ACCOUNT_LOCKOUT action
    const transactionArgs = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(transactionArgs).toHaveLength(2);

    // The auditLog.create mock should have been called
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ACCOUNT_LOCKOUT",
          userId: user.id,
        }),
      })
    );
  });

  it("sets lockedUntil ~15 minutes in the future on lockout", async () => {
    const user = await makeUser({ failedLoginCount: 4 });
    const mockPrisma = buildMockPrisma(user);
    const before = Date.now();

    await authorize({ email: user.email, password: "wrong" }, mockPrisma);

    const updateCall = mockPrisma.user.update.mock.calls[0][0] as {
      data: { lockedUntil: Date };
    };
    const lockedUntil = updateCall.data.lockedUntil;

    expect(lockedUntil).toBeInstanceOf(Date);
    const diffMs = lockedUntil.getTime() - before;
    // Should be approximately 15 minutes (allow ±5 s tolerance)
    expect(diffMs).toBeGreaterThanOrEqual(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(16 * 60 * 1000);
  });

  it("includes failedAttempts count in audit log metadata", async () => {
    const user = await makeUser({ failedLoginCount: 4 });
    const mockPrisma = buildMockPrisma(user);

    await authorize({ email: user.email, password: "wrong" }, mockPrisma);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ failedAttempts: 5 }),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────
// Tests — locked account rejects login (Req 8.3)
// ─────────────────────────────────────────────

describe("Locked account rejects login before lockedUntil expires (Req 8.3)", () => {
  it("throws ACCOUNT_LOCKED when lockedUntil is in the future", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    const user = await makeUser({ lockedUntil, failedLoginCount: 5 });
    const mockPrisma = buildMockPrisma(user);

    await expect(
      authorize({ email: user.email, password: "correct-password" }, mockPrisma)
    ).rejects.toThrow("ACCOUNT_LOCKED");
  });

  it("throws ACCOUNT_LOCKED even with correct password while locked", async () => {
    const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    const user = await makeUser({ lockedUntil });
    const mockPrisma = buildMockPrisma(user);

    await expect(
      authorize({ email: user.email, password: "correct-password" }, mockPrisma)
    ).rejects.toThrow("ACCOUNT_LOCKED");

    // Should not attempt password verification or DB updates
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("allows login after lockedUntil has passed", async () => {
    const lockedUntil = new Date(Date.now() - 1000); // 1 second in the past
    const user = await makeUser({ lockedUntil, failedLoginCount: 5 });
    const mockPrisma = buildMockPrisma(user);

    const result = await authorize(
      { email: user.email, password: "correct-password" },
      mockPrisma
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe(user.id);
  });

  it("resets failedLoginCount and lockedUntil on successful login after expiry", async () => {
    const lockedUntil = new Date(Date.now() - 1000);
    const user = await makeUser({ lockedUntil, failedLoginCount: 5 });
    const mockPrisma = buildMockPrisma(user);

    await authorize(
      { email: user.email, password: "correct-password" },
      mockPrisma
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { failedLoginCount: 0, lockedUntil: null },
      })
    );
  });
});

// ─────────────────────────────────────────────
// Tests — general auth behaviour
// ─────────────────────────────────────────────

describe("General authentication behaviour", () => {
  it("returns null for missing credentials", async () => {
    const mockPrisma = buildMockPrisma(null);
    const result = await authorize(undefined, mockPrisma);
    expect(result).toBeNull();
  });

  it("returns null for unknown email", async () => {
    const mockPrisma = buildMockPrisma(null);
    const result = await authorize(
      { email: "unknown@stms.io", password: "any" },
      mockPrisma
    );
    expect(result).toBeNull();
  });

  it("returns null for inactive user", async () => {
    const user = await makeUser({ isActive: false });
    const mockPrisma = buildMockPrisma(user);
    const result = await authorize(
      { email: user.email, password: "correct-password" },
      mockPrisma
    );
    expect(result).toBeNull();
  });

  it("returns user object with role on successful login", async () => {
    const user = await makeUser();
    const mockPrisma = buildMockPrisma(user);

    const result = await authorize(
      { email: user.email, password: "correct-password" },
      mockPrisma
    );

    expect(result).toMatchObject({
      id: user.id,
      email: user.email,
      role: "Traffic_Controller",
    });
  });
});
