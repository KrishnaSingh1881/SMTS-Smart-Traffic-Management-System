"use client";

/**
 * TrafficMap component
 * Renders the MapLibre/Mapbox map with all overlay layers.
 * Requirements: 3.1, 19.2
 *
 * Public props interface preserved for backward compatibility:
 *   segments: SegmentState[]  — passed in from the map page (unused directly;
 *   SegmentLayer fetches its own data via /api/monitoring/segments + SSE)
 */

import { useState, useCallback } from "react";
import type { SegmentState } from "@/store/useTrafficStore";
import MapCanvas from "./MapCanvas";
import SegmentLayer from "./SegmentLayer";
import SignalLayer from "./SignalLayer";
import IncidentLayer from "./IncidentLayer";
import PredictionLayer from "./PredictionLayer";
import LayerTogglePanel, { type LayerVisibility } from "./LayerTogglePanel";
import SegmentDetailPanel from "./SegmentDetailPanel";
import IntersectionPopup from "./IntersectionPopup";
import ContextMenu from "./ContextMenu";
import EmergencyVehicleMarker from "../emergency/EmergencyVehicleMarker";
import RouteOverlay from "./RouteOverlay";
import MapHUD from "./MapHUD";
import RightSidebar from "../layout/RightSidebar";
import InstitutionLayer from "./InstitutionLayer";
import SimulationHUD from "../simulation/SimulationHUD";
import UrbanLayer from "./UrbanLayer";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrafficMapProps {
  /** Preserved for backward compatibility — segments are fetched internally */
  segments: SegmentState[];
  /** Sets the map mode: 'monitor' (read-only) or 'simulation' (gamified) */
  mode?: 'monitor' | 'simulation';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrafficMap({ segments: _segments, mode = 'monitor' }: TrafficMapProps) {
  // Layer visibility (controlled by LayerTogglePanel)
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    signals: true,
    incidents: true,
    predictions: true,
  });

  // Selected segment (drives SegmentDetailPanel)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // Selected intersection (drives IntersectionPopup)
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    segmentId: string;
    position: { x: number; y: number };
  } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSegmentClick = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    // Close context menu and intersection popup when a segment is clicked
    setContextMenu(null);
    setSelectedIntersectionId(null);
  }, []);

  const handleSegmentContextMenu = useCallback(
    (segmentId: string, position: { x: number; y: number }) => {
      setContextMenu({ segmentId, position });
      setSelectedIntersectionId(null);
    },
    []
  );

  const handleIntersectionClick = useCallback((intersectionId: string) => {
    setSelectedIntersectionId(intersectionId);
    setContextMenu(null);
  }, []);

  const handleLayerVisibilityChange = useCallback((layers: LayerVisibility) => {
    setLayerVisibility(layers);
  }, []);

  const handleCloseSegmentPanel = useCallback(() => {
    setSelectedSegmentId(null);
  }, []);

  const handleCloseIntersectionPopup = useCallback(() => {
    setSelectedIntersectionId(null);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex-1 w-full h-full" style={{ minHeight: 500 }}>
      <MapCanvas className="w-full h-full">
        {/* Top-left HUD: logo, city name, simulated clock */}
        <MapHUD />

        {/* Gamified HUD (Score, XP, Events) - only in simulation mode */}
        {mode === 'simulation' && <SimulationHUD />}

        {/* Collapsible right sidebar: AI Analyst + Event Feed */}
        <RightSidebar />

        {/* Road segment layer — handles click + right-click */}
        <SegmentLayer
          onSegmentClick={handleSegmentClick}
          onSegmentContextMenu={handleSegmentContextMenu}
        />

        {/* Institution markers — hospitals, stadium, university, etc. */}
        <InstitutionLayer />
        <UrbanLayer />

        {/* Signal markers at intersections */}
        <SignalLayer
          visible={layerVisibility.signals}
          onIntersectionClick={handleIntersectionClick}
        />

        {/* Active incident pins */}
        <IncidentLayer visible={layerVisibility.incidents} />

        {/* Predicted congestion overlay */}
        <PredictionLayer visible={layerVisibility.predictions} />

        {/* Emergency route polyline overlay */}
        <RouteOverlay />

        {/* Emergency vehicle marker */}
        <EmergencyVehicleMarker />

        {/* Floating layer toggle panel (top-right) */}
        <LayerTogglePanel onVisibilityChange={handleLayerVisibilityChange} />

        {/* Slide-in segment detail panel (right edge) */}
        <SegmentDetailPanel
          segmentId={selectedSegmentId}
          onClose={handleCloseSegmentPanel}
        />

        {/* Intersection popup (bottom-center) */}
        <IntersectionPopup
          intersectionId={selectedIntersectionId}
          onClose={handleCloseIntersectionPopup}
          mode={mode}
        />
      </MapCanvas>

      {/* Context menu rendered outside MapCanvas to avoid z-index issues */}
      <ContextMenu
        segmentId={contextMenu?.segmentId ?? null}
        position={contextMenu?.position ?? null}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
}
