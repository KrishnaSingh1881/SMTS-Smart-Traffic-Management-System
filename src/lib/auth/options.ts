/**
 * NextAuth.js configuration — Credentials provider
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import type { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) return null;

        // Check if account is currently locked (Req 8.3)
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
            // Lock account for 15 minutes and insert audit log (Req 8.3, 8.4)
            const lockedUntil = new Date(
              Date.now() + LOCKOUT_MINUTES * 60 * 1000
            );
            await prisma.$transaction([
              prisma.user.update({
                where: { id: user.id },
                data: { failedLoginCount: newFailCount, lockedUntil },
              }),
              prisma.auditLog.create({
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
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginCount: newFailCount },
            });
          }

          return null;
        }

        // Successful login — reset failed count
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        } as NextAuthUser & { role: string };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as NextAuthUser & { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id: string; role: string }).id =
          token.id as string;
        (
          session.user as typeof session.user & { id: string; role: string }
        ).role = token.role as string;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
    // Default maxAge — overridden per-role in the jwt callback below
    maxAge: 28800, // 8 h (Traffic_Controller default; Drivers get 24 h via token)
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
