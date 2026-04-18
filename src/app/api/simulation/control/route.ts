/**
 * POST /api/simulation/control
 * Control the simulation engine (play, pause, reset).
 * Requirements: 6.8
 */

import { NextResponse } from "next/server";
import { simulationEngine } from "@/lib/simulation/engine";

const VALID_ACTIONS = ["play", "pause", "reset"] as const;
const VALID_SPEEDS = [1, 5, 10, 30] as const;

type Action = (typeof VALID_ACTIONS)[number];
type Speed = (typeof VALID_SPEEDS)[number];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, speed } = body as { action?: unknown; speed?: unknown };

  // Validate action
  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate speed if provided
  if (speed !== undefined && !VALID_SPEEDS.includes(speed as Speed)) {
    return NextResponse.json(
      { error: `Invalid speed. Must be one of: ${VALID_SPEEDS.join(", ")}` },
      { status: 400 }
    );
  }

  const typedAction = action as Action;
  const typedSpeed = speed as Speed | undefined;

  switch (typedAction) {
    case "play":
      simulationEngine.play(typedSpeed);
      break;
    case "pause":
      simulationEngine.pause();
      break;
    case "reset":
      simulationEngine.reset();
      break;
  }

  const state = simulationEngine.getState();

  return NextResponse.json({
    state: state.state,
    simulatedTime: state.simulatedTime,
    speed: state.speed,
  });
}
