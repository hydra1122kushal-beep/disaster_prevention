import React, { useState } from 'react';
import {
  CheckCircle2,
  Map as MapIcon,
  Box,
  Radio,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FieldRequest,
  OptimizationResult,
  ROAD_EDGES,
  ReliefCamp,
  VerificationTask,
  Village,
} from '../engine/disasterEngine';
import { TacticalLeafletMap } from './TacticalLeafletMap';
import { BasinScene3D } from './BasinScene3D';

interface ControlRoomViewProps {
  villages: Village[];
  camps: ReliefCamp[];
  optimization: OptimizationResult;
  rainfallMm: number;
  onRainfallChange: (val: number) => void;
  manualCutEdges: string[];
  onToggleCutBridge: (edgeId: string) => void;
  equityWeighted: boolean;
  onToggleEquityWeighted: (val: boolean) => void;
  networkDown: boolean;
  onToggleNetworkDown: () => void;
  offlineQueue: FieldRequest[];
  onFlushOfflineQueue: () => void;
  verificationTasks: VerificationTask[];
  onResolveVerificationTask: (taskId: string, villageId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onApplyDemoPreset: (preset: 'baseline' | 'surge' | 'lowconf' | 'cutbridge' | 'outage') => void;
  activePreset: string;
}

export const ControlRoomView: React.FC<ControlRoomViewProps> = ({
  villages,
  camps,
  optimization,
  rainfallMm,
  onRainfallChange,
  manualCutEdges,
  onToggleCutBridge,
  equityWeighted,
  onToggleEquityWeighted,
  networkDown,
  onToggleNetworkDown,
  offlineQueue,
  onFlushOfflineQueue,
  verificationTasks,
  onResolveVerificationTask,
  selectedNodeId,
  onSelectNode,
  onApplyDemoPreset,
  activePreset,
}) => {
  const [mapMode, setMapMode] = useState<'leaflet' | '3d'>('leaflet');
  const [searchQuery, setSearchQuery] = useState('');

  const bridges = ROAD_EDGES.filter((e) => e.isBridge);
  const pendingVerifications = verificationTasks.filter((t) => t.status === 'pending');
  const unsyncedOffline = offlineQueue.filter((q) => !q.synced);

  const selectedScored = selectedNodeId
    ? optimization.scoredVillages.find((s) => s.village.id === selectedNodeId)
    : null;

  const filteredVillages = optimization.scoredVillages.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.village.name.toLowerCase().includes(q) ||
      s.village.id.toLowerCase().includes(q) ||
      s.village.sector.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8 space-y-8">
      {/* Header + 5-Minute Demo Scenario Presets */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-white/10">
        <div>
          <div className="text-xs text-[#A1A8B0] font-mono-tabular">
            Control Room · Simulated Kosi-Mechi District · Auto-Re-Optimization Active
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.02em] text-[#F2F0EB]">
            Dispatch, Forecasting & Equity Console
          </h1>
        </div>

        {/* One-Click Demo Script Triggers */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#121820] p-1.5 rounded-lg border border-white/10">
          {(
            [
              { id: 'baseline', label: '1. Baseline' },
              { id: 'surge', label: '2. 210mm Forecast' },
              { id: 'lowconf', label: '3. Low-Conf Vision' },
              { id: 'cutbridge', label: '4. Cut Bridge B2' },
              { id: 'outage', label: '5. Network Down' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyDemoPreset(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activePreset === p.id
                  ? 'bg-[#D94E28] text-white'
                  : 'text-[#A1A8B0] hover:text-[#ECEAE4] hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Forecast Regression & Equity Scoring Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#121820] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-[#A1A8B0]">Lightweight Rainfall Regression Model</div>
              <div className="mt-0.5 text-xs font-mono-tabular text-[#6E7782]">
                {optimization.forecast.regressionEquation}
              </div>
            </div>
            <div className="font-mono-tabular text-sm font-medium text-[#ECEAE4]">
              {rainfallMm} mm/24h · {optimization.forecast.riskTier}
            </div>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={280}
              step={5}
              value={rainfallMm}
              onChange={(e) => onRainfallChange(Number(e.target.value))}
              aria-label="Rainfall forecast slider"
              className="meridian-slider w-full"
            />
            <div className="mt-1.5 flex justify-between text-[11px] font-mono-tabular text-[#6E7782]">
              <span>0 mm (Dry)</span>
              <span>80 mm (Watch)</span>
              <span>160 mm (Surge)</span>
              <span>280 mm (Extreme)</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/8 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-[#6E7782]">Demand Multiplier</div>
              <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#ECEAE4]">
                {optimization.forecast.demandMultiplier}x
              </div>
            </div>
            <div>
              <div className="text-xs text-[#6E7782]">Predicted River Level</div>
              <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#3B8EA5]">
                {optimization.forecast.riverLevelM} m
              </div>
            </div>
            <div>
              <div className="text-xs text-[#6E7782]">Flooded Villages</div>
              <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#D94E28]">
                {optimization.scoredVillages.filter((s) => s.isFlooded).length} / 12
              </div>
            </div>
          </div>
        </div>

        {/* Equity Fairness Meter & Mode Switch */}
        <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#121820] p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-[#A1A8B0]">Routing Equity Objective</div>
              <div className="mt-1 font-display text-2xl font-semibold font-mono-tabular text-[#ECEAE4]">
                Fairness {optimization.fairnessScore} / 100
              </div>
              <div className="mt-0.5 text-xs text-[#A1A8B0] font-mono-tabular">
                Remote vs. Highway Coverage Gap: {optimization.coverageGapPct}%
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#18202a] p-1 rounded-lg border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => onToggleEquityWeighted(true)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  equityWeighted ? 'bg-[#ECEAE4] text-[#0C1014]' : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                Equity-Weighted
              </button>
              <button
                type="button"
                onClick={() => onToggleEquityWeighted(false)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  !equityWeighted ? 'bg-[#ECEAE4] text-[#0C1014]' : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                Efficiency-Only
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 w-full bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${optimization.fairnessScore}%`,
                  backgroundColor:
                    optimization.fairnessScore >= 80
                      ? '#3C9D6E'
                      : optimization.fairnessScore >= 65
                        ? '#D49A3A'
                        : '#D94E28',
                }}
              />
            </div>
            <p className="mt-2.5 text-xs text-[#A1A8B0] leading-relaxed">
              {equityWeighted
                ? 'Equity weighting boosts isolated communities with long wait times (16h+), lifting remote fulfillment parity.'
                : 'Efficiency-only routing minimizes vehicle kilometers, prioritizing highway-adjacent villages and widening the remote coverage gap.'}
            </p>
          </div>
        </div>
      </div>

      {/* Synchronized Map Viewport + Right-Side Infrastructure & Verification Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[#ECEAE4]">
              Live Routing Map · {optimization.dispatches.reduce((a, b) => a + b.stops.length, 0)} Active Dispatch Stops
            </div>
            <div className="flex items-center gap-1 bg-[#121820] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setMapMode('leaflet')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mapMode === 'leaflet' ? 'bg-[#ECEAE4] text-[#0C1014]' : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Leaflet 2D</span>
              </button>
              <button
                type="button"
                onClick={() => setMapMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mapMode === '3d' ? 'bg-[#ECEAE4] text-[#0C1014]' : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Basin</span>
              </button>
            </div>
          </div>

          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-white/10 bg-[#0d1218]">
            {mapMode === 'leaflet' ? (
              <TacticalLeafletMap
                villages={villages}
                camps={camps}
                optimization={optimization}
                networkDown={networkDown}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onToggleCutBridge={onToggleCutBridge}
              />
            ) : (
              <BasinScene3D
                villages={villages}
                camps={camps}
                optimization={optimization}
                rainfallMm={rainfallMm}
                onRainfallChange={onRainfallChange}
                manualCutEdges={manualCutEdges}
                onToggleCutBridge={onToggleCutBridge}
                networkDown={networkDown}
                onToggleNetworkDown={onToggleNetworkDown}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                compactHero
              />
            )}
          </div>
        </div>

        {/* Right Side Panel: Bridge Cuts, Verification Tasks & Offline Queue */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* River Crossings / Bridge Sever Controls */}
          <div className="rounded-xl border border-white/10 bg-[#121820] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#F2F0EB]">River Crossings & Cut Roads</h2>
              <span className="text-xs font-mono-tabular text-[#6E7782]">
                {optimization.activeCutEdgeIds.length} severed
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {bridges.map((b) => {
                const isCut = optimization.activeCutEdgeIds.includes(b.id);
                const floodedOut = optimization.forecast.riverLevelM >= b.clearanceM;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-white/8 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#ECEAE4] truncate">{b.bridgeName}</div>
                      <div className="text-[11px] font-mono-tabular text-[#6E7782]">
                        Clearance {b.clearanceM}m · {floodedOut ? 'Submerged by surge' : isCut ? 'Manually cut' : 'Passable'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={floodedOut}
                      onClick={() => onToggleCutBridge(b.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                        floodedOut
                          ? 'border-white/10 text-[#6E7782] cursor-not-allowed'
                          : isCut
                            ? 'bg-[#D94E28] border-[#D94E28] text-white'
                            : 'bg-[#19212c] border-white/12 text-[#D3D6DB] hover:border-white/30'
                      }`}
                    >
                      <Scissors className="w-3 h-3" />
                      <span>{floodedOut ? 'Flooded' : isCut ? 'Restore' : 'Cut Road'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low-Confidence YOLOv8 Verification Tasks */}
          <div className="rounded-xl border border-white/10 bg-[#121820] p-5 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#F2F0EB]">Perception Verification Queue</h2>
              <span className="text-xs font-mono-tabular text-[#D49A3A]">
                {pendingVerifications.length} pending
              </span>
            </div>
            {pendingVerifications.length === 0 ? (
              <p className="mt-3 text-xs text-[#6E7782]">
                All active village detections exceed the 70% YOLOv8 confidence threshold or have been verified by a
                dispatcher.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {pendingVerifications.map((task) => (
                  <div key={task.id} className="pt-2.5 border-t border-white/8 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#ECEAE4]">
                        {task.villageName} ({task.villageId})
                      </span>
                      <span className="font-mono-tabular text-[#D49A3A]">
                        {Math.round(task.confidence * 100)}% conf
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#A1A8B0]">{task.reason}</p>
                    <button
                      type="button"
                      onClick={() => onResolveVerificationTask(task.id, task.villageId)}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#1b2430] text-[#ECEAE4] border border-white/12 rounded hover:border-[#3C9D6E] transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#3C9D6E]" />
                      <span>Verify Count ({task.detectedCount})</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offline Queue & Simulated Mesh Relay Status */}
          <div className="rounded-xl border border-white/10 bg-[#121820] p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#D49A3A]" />
                <h2 className="font-display text-sm font-semibold text-[#F2F0EB]">Comms & Offline Queue</h2>
              </div>
              <button
                type="button"
                onClick={onToggleNetworkDown}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  networkDown
                    ? 'bg-[#D49A3A] border-[#D49A3A] text-[#0C1014]'
                    : 'bg-[#19212c] border-white/12 text-[#D3D6DB]'
                }`}
              >
                {networkDown ? 'Network Offline' : 'Simulate Outage'}
              </button>
            </div>
            <div className="mt-2.5 text-xs text-[#A1A8B0] font-mono-tabular">
              Queued packets: {unsyncedOffline.length} · Active mesh hops: {optimization.meshRelayPaths.length}
            </div>
            {unsyncedOffline.length > 0 && (
              <div className="mt-3 space-y-2">
                {unsyncedOffline.slice(0, 2).map((q) => (
                  <div key={q.id} className="bg-[#0d1218] border border-white/8 rounded px-2.5 py-2 text-[11px] font-mono-tabular text-[#D49A3A]">
                    <div>SMS: {q.smsPayload}</div>
                    <div className="text-[#6E7782] mt-0.5">Mesh: {q.meshHops.join(' -> ')}</div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={onFlushOfflineQueue}
                  className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#ECEAE4] text-[#0C1014] rounded-lg hover:bg-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore Network & Sync Queue ({unsyncedOffline.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Node Highlight Strip (if clicked on map) */}
      {selectedScored && (
        <div className="rounded-xl border border-white/15 bg-[#151C24] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono-tabular text-[#A1A8B0]">
              Inspected Node · {selectedScored.village.id} · {selectedScored.village.sector}
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-[#F2F0EB]">
              {selectedScored.village.name} — Priority {selectedScored.priorityScore}/100
            </div>
            <div className="mt-1 text-sm text-[#D3D6DB]">{selectedScored.reasonText}</div>
          </div>
          <button
            type="button"
            onClick={() => onSelectNode(null)}
            className="px-3.5 py-1.5 text-xs font-medium border border-white/15 rounded-lg text-[#A1A8B0] hover:text-[#ECEAE4] self-start md:self-auto"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* EXPLAINABLE VEHICLE DISPATCH TABLE */}
      <div className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F2F0EB]">
              Explainable Fleet Dispatch Assignments
            </h2>
            <p className="text-xs text-[#A1A8B0] mt-0.5">
              Every stop displays its computed priority score, payload allocation, ETA, and human-readable dispatch
              reason.
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-[#6E7782]">
            OR-Tools Style VRP · 4 Vehicles Active
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-mono-tabular text-[#6E7782]">
                <th className="py-3 px-5 font-medium">Vehicle / Camp</th>
                <th className="py-3 px-4 font-medium">Stop Sequence</th>
                <th className="py-3 px-4 font-medium text-right">Priority</th>
                <th className="py-3 px-4 font-medium text-right">Payload</th>
                <th className="py-3 px-4 font-medium text-right">ETA</th>
                <th className="py-3 px-5 font-medium">Explainability Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {optimization.dispatches.flatMap((d) =>
                d.stops.length === 0 ? (
                  <tr key={d.vehicle.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-5 font-medium text-[#ECEAE4]">
                      {d.vehicle.callsign}
                      <div className="text-xs text-[#6E7782] font-normal">
                        {d.vehicle.type} · {d.camp.name}
                      </div>
                    </td>
                    <td colSpan={5} className="py-3.5 px-4 text-xs text-[#6E7782]">
                      Standby at {d.camp.name} — no reachable unassigned stops within current road constraints.
                    </td>
                  </tr>
                ) : (
                  d.stops.map((stop, idx) => (
                    <tr
                      key={`${d.vehicle.id}-${stop.villageId}`}
                      onClick={() => onSelectNode(stop.villageId)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 align-top">
                        {idx === 0 ? (
                          <div>
                            <div className="font-medium text-[#ECEAE4]">{d.vehicle.callsign}</div>
                            <div className="text-xs text-[#6E7782]">
                              {d.vehicle.type} · {d.utilizationPct}% load
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-[#6E7782] font-mono-tabular">Leg {idx + 1}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-medium text-[#ECEAE4]">
                          {stop.villageName}{' '}
                          <span className="text-xs font-mono-tabular text-[#6E7782]">({stop.villageId})</span>
                        </div>
                        <div className="text-xs font-mono-tabular text-[#6E7782]">
                          Path: {stop.pathNodeIds.join(' -> ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular font-medium">
                        <span
                          className={
                            stop.priorityScore >= 78
                              ? 'text-[#E04F28]'
                              : stop.priorityScore >= 62
                                ? 'text-[#D49A3A]'
                                : 'text-[#3C9D6E]'
                          }
                        >
                          {stop.priorityScore}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular text-[#ECEAE4]">
                        {stop.payloadKg} kg
                      </td>
                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular text-[#A1A8B0]">
                        {stop.etaMinutes} min
                      </td>
                      <td className="py-3.5 px-5 align-top text-xs text-[#D3D6DB] leading-relaxed max-w-md">
                        {stop.reasonText}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALL 12 VILLAGES PRIORITY LEDGER */}
      <div className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#A1A8B0]" />
            <h2 className="font-display text-base font-semibold text-[#F2F0EB]">
              District Village Priority Ledger (12 Villages)
            </h2>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by village or sector..."
            className="bg-[#0d1218] border border-white/12 rounded-lg px-3 py-1.5 text-xs text-[#ECEAE4] placeholder-[#6E7782] w-60 focus:outline-none focus:border-[#D94E28]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-mono-tabular text-[#6E7782]">
                <th className="py-2.5 px-5 font-medium">Village</th>
                <th className="py-2.5 px-4 font-medium">Sector</th>
                <th className="py-2.5 px-4 font-medium text-right">Elevation</th>
                <th className="py-2.5 px-4 font-medium text-right">Vision Conf</th>
                <th className="py-2.5 px-4 font-medium text-right">Wait</th>
                <th className="py-2.5 px-4 font-medium text-right">Demand</th>
                <th className="py-2.5 px-5 font-medium text-right">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-xs">
              {filteredVillages.map((s) => (
                <tr
                  key={s.village.id}
                  onClick={() => onSelectNode(s.village.id)}
                  className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-5 font-medium text-[#ECEAE4]">
                    {s.village.name}{' '}
                    <span className="font-mono-tabular text-[#6E7782]">{s.village.id}</span>
                  </td>
                  <td className="py-2.5 px-4 text-[#A1A8B0]">{s.village.sector}</td>
                  <td className="py-2.5 px-4 text-right font-mono-tabular text-[#A1A8B0]">
                    {s.village.elevationM}m {s.isFlooded ? '(Flooded)' : ''}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono-tabular">
                    <span className={s.needsVerification ? 'text-[#D49A3A]' : 'text-[#ECEAE4]'}>
                      {Math.round(s.village.visionConfidence * 100)}%
                      {s.needsVerification ? ' · Verify' : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono-tabular text-[#A1A8B0]">
                    {s.village.hoursSinceDelivery}h
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono-tabular text-[#ECEAE4]">
                    {s.effectiveDemandKg} kg
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono-tabular font-semibold text-[#ECEAE4]">
                    {s.priorityScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
