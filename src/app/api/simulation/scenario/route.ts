/**
 * POST /api/simulation/scenario
 * Trigger a simulation scenario preset.
 * Requirements: 9.1
 */

import { NextResponse } from "next/server";
import { simulationEngine } from "@/lib/simulation/engine";
import type { ScenarioType } from "@/lib/simulation/types";

const VALID_SCENARIOS: ScenarioType[] = [
  "rush_hour",
  "stadium_exodus",
  "major_accident",
  "flash_flood",
];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scenario } = body as { scenario?: unknown };

  if (!scenario || !VALID_SCENARIOS.includes(scenario as ScenarioType)) {
    return NextResponse.json(
      {
        error: `Invalid scenario. Must be one of: ${VALID_SCENARIOS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  await simulationEngine.triggerScenario(scenario as ScenarioType);

  return NextResponse.json({
    scenarioId: crypto.randomUUID(),
    affectedSegments: [],
  });
}
