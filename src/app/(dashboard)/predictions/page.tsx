"use client";

/**
 * Congestion Predictions dashboard page
 * Requirements: 5.3, 5.4
 *
 * Displays forecast cards for all segments with predictions.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTrafficStore } from "@/store/useTrafficStore";
import PredictionCard from "@/components/predictions/PredictionCard";
import ClayButton from "@/components/ui/ClayButton";
import { staggerChildren, fadeInUp } from "@/lib/utils/motion";
import type { CongestionLevel } from "@prisma/client";

interface PredictionData {
  id: string;
  segmentId: string;
  segmentName: string;
  predictedLevel: CongestionLevel;
  targetWindowMinutes: 60 | 120;
  confidenceScore: number;
  predictedAt: string;
}

export default function PredictionsPage() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const segments = useTrafficStore((state) => state.segments);

  // Fetch predictions
  async function fetchPredictions() {
    try {
      const res = await fetch("/api/predictions");
      if (res.ok) {
        const data: PredictionData[] = await res.json();
        setPredictions(data);
      }
    } finally {
      setLoading(false);
    }
  }

  // Trigger prediction run for all segments
  async function triggerPredictions() {
    setTriggering(true);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        // Refresh predictions after a short delay
        setTimeout(() => {
          fetchPredictions();
        }, 2000);
      }
    } catch (error) {
      console.error("Error triggering predictions:", error);
    } finally {
      setTriggering(false);
    }
  }

  useEffect(() => {
    fetchPredictions();
  }, []);

  // Group predictions by segment
  const predictionsBySegment = predictions.reduce((acc, pred) => {
    if (!acc[pred.segmentId]) {
      acc[pred.segmentId] = {
        segmentName: pred.segmentName,
        prediction60: undefined,
        prediction120: undefined,
      };
    }

    if (pred.targetWindowMinutes === 60) {
      acc[pred.segmentId].prediction60 = {
        level: pred.predictedLevel,
        confidence: pred.confidenceScore,
        predictedAt: pred.predictedAt,
      };
    } else if (pred.targetWindowMinutes === 120) {
      acc[pred.segmentId].prediction120 = {
        level: pred.predictedLevel,
        confidence: pred.confidenceScore,
        predictedAt: pred.predictedAt,
      };
    }

    return acc;
  }, {} as Record<string, {
    segmentName: string;
    prediction60?: { level: CongestionLevel; confidence: number; predictedAt: string };
    prediction120?: { level: CongestionLevel; confidence: number; predictedAt: string };
  }>);

  const segmentIds = Object.keys(predictionsBySegment);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--clay-text)]">
          Congestion Predictions
        </h1>
        <ClayButton
          onClick={triggerPredictions}
          disabled={triggering}
          className="text-sm"
        >
          {triggering ? "Generating..." : "Refresh Predictions"}
        </ClayButton>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-sm text-[var(--clay-text-muted)]">
          Loading predictions…
        </p>
      ) : segmentIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-sm text-[var(--clay-text-muted)]">
            No predictions available yet.
          </p>
          <ClayButton onClick={triggerPredictions} disabled={triggering}>
            {triggering ? "Generating..." : "Generate Predictions"}
          </ClayButton>
        </div>
      ) : (
        <motion.div
          variants={staggerChildren}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {segmentIds.map((segmentId) => {
            const data = predictionsBySegment[segmentId];
            return (
              <motion.div key={segmentId} variants={fadeInUp}>
                <PredictionCard
                  segmentName={data.segmentName}
                  prediction60={data.prediction60}
                  prediction120={data.prediction120}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
