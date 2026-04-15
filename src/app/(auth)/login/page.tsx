"use client";

/**
 * Login page — Claymorphism design with Framer Motion animation
 * Requirements: 8.2, 8.3
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { fadeInUp, staggerChildren } from "@/lib/utils/motion";
import ClayInput from "@/components/ui/ClayInput";
import ClayButton from "@/components/ui/ClayButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "ACCOUNT_LOCKED") {
          setError(
            "Your account is locked due to too many failed attempts. Try again in 15 minutes."
          );
        } else {
          setError("Invalid email or password. Please try again.");
        }
      } else {
        router.push("/monitoring");
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      className="w-full max-w-sm px-4"
      variants={staggerChildren}
      initial="hidden"
      animate="visible"
    >
      {/* Logo / title */}
      <motion.div variants={fadeInUp} className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--clay-text)]">STMS</h1>
        <p className="mt-1 text-sm text-[var(--clay-muted)]">
          Smart Traffic Management System
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        variants={fadeInUp}
        className="rounded-clay bg-[var(--clay-surface)] border border-[var(--clay-border)] shadow-clay p-8"
      >
        <h2 className="mb-6 text-lg font-semibold text-[var(--clay-text)]">
          Sign in
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ClayInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <ClayInput
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          {/* Inline error message (Req 8.3) */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-[var(--clay-danger)] rounded-clay bg-[var(--clay-danger)]/10 px-3 py-2"
            >
              {error}
            </motion.p>
          )}

          <ClayButton
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="mt-2 w-full"
          >
            Sign in
          </ClayButton>
        </form>
      </motion.div>
    </motion.div>
  );
}
