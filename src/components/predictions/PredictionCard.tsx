"use client";

/**
 * PredictionCard component
 * Requirements: 5.3, 5.4
 *
 * Displays congestion predictions for a segment with:
 * - Segment name
 * - 60-min and 120-min predicted levels
 * - Confidence score
 * - Last-updated time
 * - Animated pulse border for Heavy/Gridlock predictions
 */

import { motion } from "framer-motion";
import ClayCard from "@/components/ui/ClayCard";
import CongestionBadge from "@/components/monitoring/CongestionBadge";
import type { CongestionLevel } from "@prisma/client";

interface PredictionCardProps {
  segmentName: string;
  prediction60?: {
    level: CongestionLevel;
    confidence: number;
    predictedAt: string;
  };
  prediction120?: {
    level: CongestionLevel;
    confidence: number;
    predictedAt: string;
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function PredictionCard({
  segmentName,
  prediction60,
  prediction120,
}: PredictionCardProps) {
  // Check if we should highlight (Heavy or Gridlock at 60 min)
  const shouldHighlight =
    prediction60 &&
    (prediction60.level === "Heavy" || prediction60.level === "Gridlock");

  const cardContent = (
    <ClayCard className="flex flex-col gap-4">
      {/* Header */}
      <h3 className="text-sm font-semibold text-[var(--clay-text)] leading-tight">
        {segmentName}
      </h3>

      {/* Predictions */}
      <div className="flex flex-col gap-3">
        {/* 60-minute prediction */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-[var(--clay-text-muted)] mb-1">
              60 minutes
            </p>
            {prediction60 ? (
              <div className="flex items-center gap-2">
                <CongestionBadge level={prediction60.level} />
                <span className="text-xs text-[var(--clay-text-muted)]">
                  {formatConfidence(prediction60.confidence)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--clay-text-muted)]">
                No prediction
              </p>
            )}
          </div>
        </div>

        {/* 120-minute prediction */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-[var(--clay-text-muted)] mb-1">
              120 minutes
            </p>
            {prediction120 ? (
              <div className="flex items-center gap-2">
                <CongestionBadge level={prediction120.level} />
                <span className="text-xs text-[var(--clay-text-muted)]">
                  {formatConfidence(prediction120.confidence)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--clay-text-muted)]">
                No prediction
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Last updated */}
      {(prediction60 || prediction120) && (
        <p className="text-xs text-[var(--clay-text-muted)]">
          Updated: {formatTime(prediction60?.predictedAt || prediction120!.predictedAt)}
        </p>
      )}
    </ClayCard>
  );

  // Wrap with animated pulse border for Heavy/Gridlock predictions
  if (shouldHighlight) {
    return (
      <motion.div
        className="relative"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(239, 68, 68, 0)",
            "0 0 0 4px rgba(239, 68, 68, 0.3)",
            "0 0 0 0 rgba(239, 68, 68, 0)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          borderRadius: "var(--clay-border-radius)",
        }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
}
