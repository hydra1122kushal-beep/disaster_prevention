import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Eye,
  Radio,
  Scale,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import {
  FIELD_IMAGES,
  OptimizationResult,
  ReliefCamp,
  Village,
} from '../engine/disasterEngine';
import { BasinScene3D } from './BasinScene3D';
import { TiltFrame3D } from './TiltFrame3D';

export type AppView = 'overview' | 'basin' | 'control' | 'intake' | 'report';

interface OverviewViewProps {
  villages: Village[];
  camps: ReliefCamp[];
  optimization: OptimizationResult;
  rainfallMm: number;
  onRainfallChange: (val: number) => void;
  manualCutEdges: string[];
  onToggleCutBridge: (edgeId: string) => void;
  networkDown: boolean;
  onToggleNetworkDown: () => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNavigate: (view: AppView) => void;
  onToggleChecklistItem: (villageId: string, itemId: string) => void;
  onApplyDemoPreset: (preset: 'baseline' | 'surge' | 'lowconf' | 'cutbridge' | 'outage') => void;
}

const LITERATURE_GAPS = [
  {
    index: '01',
    gap: 'Forecasting and optimization are disconnected',
    feature: 'Forecast auto-triggers re-routing',
    detail:
      'A rainfall regression model updates the district demand multiplier and floodwater stage, immediately re-scoring village priorities and dispatching detours.',
    actionLabel: 'Test Rainfall Surge',
    targetView: 'basin' as AppView,
    preset: 'surge' as const,
    icon: Waves,
  },
  {
    index: '02',
    gap: 'Last-mile perception errors distort dispatch',
    feature: 'Confidence feeds priority and spawns verification',
    detail:
      'YOLOv8 headcount and confidence weight each village priority. Detections below 70% confidence automatically open a control-room verification task.',
    actionLabel: 'Open Vision Intake',
    targetView: 'intake' as AppView,
    preset: 'lowconf' as const,
    icon: Eye,
  },
  {
    index: '03',
    gap: 'Siloed, unverified synthetic datasets',
    feature: 'Unified schema with explicit simulated labeling',
    detail:
      'Villages, camps, vehicles, road edges, and dispatches share one inspectable schema where simulated district records are transparently labeled and exportable.',
    actionLabel: 'Inspect Schema',
    targetView: 'report' as AppView,
    preset: 'baseline' as const,
    icon: Compass,
  },
  {
    index: '04',
    gap: 'Cellular failure halts field intake',
    feature: 'Offline queue, SMS fallback, simulated mesh relay',
    detail:
      'When towers drop, requests compress into 42-byte SMS packets and route across multi-hop simulated LoRa mesh links until connectivity returns.',
    actionLabel: 'Simulate Network Outage',
    targetView: 'control' as AppView,
    preset: 'outage' as const,
    icon: Radio,
  },
  {
    index: '05',
    gap: 'Opaque black-box routing neglects remote villages',
    feature: 'Plain-English dispatch reasons and fairness score',
    detail:
      'Every stop carries an explicit factor breakdown alongside a live equity score tracking fulfillment parity between highway hubs and isolated delta villages.',
    actionLabel: 'Inspect Equity Score',
    targetView: 'control' as AppView,
    preset: 'baseline' as const,
    icon: Scale,
  },
];

const DRILL_SCHEDULE = [
  {
    date: 'Day 01 · 06:30',
    sector: 'North Basin (V01–V03)',
    drill: 'High-water embankment staging & water cache seal audit',
    lead: 'North Ridge Depot',
  },
  {
    date: 'Day 02 · 08:00',
    sector: 'Central Valley (V04–V08)',
    drill: 'Bridge B2 bypass drill & amphibious carrier load test',
    lead: 'East Valley Staging',
  },
  {
    date: 'Day 03 · 14:00',
    sector: 'South Delta (V09–V12)',
    drill: 'Simulated cellular blackout & 3-hop LoRa mesh relay check',
    lead: 'South Highway Hub',
  },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  villages,
  camps,
  optimization,
  rainfallMm,
  onRainfallChange,
  manualCutEdges,
  onToggleCutBridge,
  networkDown,
  onToggleNetworkDown,
  selectedNodeId,
  onSelectNode,
  onNavigate,
  onToggleChecklistItem,
  onApplyDemoPreset,
}) => {
  const [prepVillageId, setPrepVillageId] = useState<string>('V04');
  const prepVillage = villages.find((v) => v.id === prepVillageId) || villages[0];
  const completedChecks = prepVillage.readinessChecklist.filter((c) => c.done).length;
  const readinessPct = Math.round((completedChecks / prepVillage.readinessChecklist.length) * 100);

  return (
    <div className="w-full">
      {/* HERO SPLIT SECTION */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-10 pt-10 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Editorial Column */}
          <div className="lg:col-span-5 flex flex-col justify-between py-2">
            <div>
              <div className="text-xs text-[#A1A8B0] font-mono-tabular">
                Disaster Preparedness · Essential Supply Coordination · Simulated Basin
              </div>

              <h1 className="mt-5 font-display text-[clamp(2.35rem,3.9vw,3.6rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-[#F2F0EB] text-balance-headline">
                Coordinate readiness before floodwaters cut the road.
              </h1>

              <p className="mt-5 text-[15.5px] leading-[1.68] text-[#A1A8B0] max-w-[54ch]">
                Meridian Relief links pre-disaster village preparedness with live rainfall forecasting, vision-assisted
                need assessment, and equitable vehicle routing across 12 floodplain communities.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('basin')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium bg-[#D94E28] text-white rounded-lg hover:bg-[#c54320] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Enter 3D Flood Basin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('control')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium bg-[#171E27] text-[#ECEAE4] border border-white/12 rounded-lg hover:border-white/25 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Open Control Room</span>
                </button>
              </div>
            </div>

            {/* Quiet Documentary Proof Strip */}
            <div className="mt-10 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[#6E7782]">Current Stage</div>
                <div className="mt-1 font-mono-tabular text-base font-medium text-[#ECEAE4]">
                  {optimization.forecast.riskTier}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6E7782]">Demand Multiplier</div>
                <div className="mt-1 font-mono-tabular text-base font-medium text-[#ECEAE4]">
                  {optimization.forecast.demandMultiplier}x
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6E7782]">Active Detours</div>
                <div className="mt-1 font-mono-tabular text-base font-medium text-[#ECEAE4]">
                  {optimization.activeCutEdgeIds.length} bridges cut
                </div>
              </div>
            </div>
          </div>

          {/* Right Live 3D Watershed Diorama (Full height stretch) */}
          <div className="lg:col-span-7 min-h-[450px] lg:min-h-[540px] rounded-xl overflow-hidden border border-white/10 bg-[#0c1117]">
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
          </div>
        </div>

        {/* Full-Width 4-Column District Telemetry Row Below Hero Split */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 border border-white/10 rounded-xl bg-[#11161D] divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          <div className="p-5">
            <div className="text-xs text-[#A1A8B0]">Seeded District Coverage</div>
            <div className="mt-1.5 font-display text-2xl font-semibold font-mono-tabular text-[#ECEAE4]">
              12 Villages
            </div>
            <div className="mt-1 text-xs text-[#6E7782] font-mono-tabular">
              {optimization.servedVillagesCount} routed · {optimization.unservedVillagesCount} queued
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-[#A1A8B0]">Supply Infrastructure</div>
            <div className="mt-1.5 font-display text-2xl font-semibold font-mono-tabular text-[#ECEAE4]">
              3 Camps · 4 Vehicles
            </div>
            <div className="mt-1 text-xs text-[#6E7782] font-mono-tabular">
              8,800 kg total active fleet capacity
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-[#A1A8B0]">Equity Fairness Score</div>
            <div className="mt-1.5 font-display text-2xl font-semibold font-mono-tabular text-[#ECEAE4]">
              {optimization.fairnessScore} / 100
            </div>
            <div className="mt-1 text-xs text-[#6E7782] font-mono-tabular">
              {optimization.coverageGapPct}% remote-to-highway gap
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-[#A1A8B0]">Comms Resilience Mode</div>
            <div className="mt-1.5 font-display text-2xl font-semibold text-[#ECEAE4]">
              {networkDown ? 'Offline Mesh' : 'Cellular Live'}
            </div>
            <div className="mt-1 text-xs text-[#6E7782] font-mono-tabular">
              {networkDown
                ? `${optimization.meshRelayPaths.length} multi-hop LoRa links active`
                : 'SMS & mesh standby armed'}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FIVE LITERATURE GAPS CLOSED IN ONE LOOP (3D TILT ARCHITECTURAL GRID) */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-10 py-14 border-t border-white/10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs text-[#A1A8B0]">Research Architecture · Closed-Loop Coordination</div>
            <h2 className="mt-2 font-display text-[clamp(1.7rem,2.6vw,2.35rem)] font-semibold tracking-[-0.02em] text-[#F2F0EB] text-balance-headline">
              Five humanitarian logistics gaps addressed directly in code.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('report')}
            className="text-sm text-[#A1A8B0] hover:text-[#ECEAE4] underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            View full gap-to-feature matrix & limitations
          </button>
        </div>

        <div className="mt-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {LITERATURE_GAPS.map((item) => {
            const Icon = item.icon;
            return (
              <TiltFrame3D
                key={item.index}
                className="rounded-xl border border-white/10 bg-[#121820] p-6 flex flex-col justify-between cursor-pointer hover:border-white/25 transition-colors"
                onClick={() => {
                  onApplyDemoPreset(item.preset);
                  onNavigate(item.targetView);
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#6E7782] font-mono-tabular">
                    <span>{item.index}. Literature Gap</span>
                    <Icon className="w-4 h-4 text-[#A1A8B0]" />
                  </div>
                  <p className="mt-3 text-xs text-[#A1A8B0]">{item.gap}</p>
                  <h3 className="mt-1.5 font-display text-lg font-semibold text-[#F2F0EB] leading-snug">
                    {item.feature}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#A1A8B0]">{item.detail}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-medium text-[#ECEAE4]">
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D94E28]" />
                </div>
              </TiltFrame3D>
            );
          })}

          {/* 6th slot: Documentary Field Verification Photo Card */}
          <TiltFrame3D
            className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden flex flex-col justify-between cursor-pointer hover:border-white/25 transition-colors"
            onClick={() => onNavigate('intake')}
          >
            <div className="relative h-44 w-full bg-[#18202a] overflow-hidden">
              <img
                src={FIELD_IMAGES.floodVillage}
                alt="Aerial documentary view of residents sheltering on rooftops during monsoon flood"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121820] via-black/30 to-transparent" />
              <div className="absolute bottom-3 left-5 right-5 text-xs text-[#ECEAE4] font-mono-tabular">
                YOLOv8 Field Intake · 3 Documentary Samples + Custom Upload
              </div>
            </div>
            <div className="p-6 pt-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#F2F0EB]">
                  Upload field photos to score priority live
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A1A8B0]">
                  Inspect bounding boxes, simulate monsoon fog occlusion, and see low-confidence uploads trigger human
                  verification tasks automatically.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-medium text-[#ECEAE4]">
                <span>Open Field Intake & Vision</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D94E28]" />
              </div>
            </div>
          </TiltFrame3D>
        </div>
      </section>

      {/* SECTION 3: BEFORE-DISASTER PREPAREDNESS (ALERTS, CHECKLISTS, DRILLS) */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-10 py-14 border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Interactive Village Readiness Checklist */}
          <div className="lg:col-span-7">
            <div className="text-xs text-[#A1A8B0]">Pre-Disaster Preparedness Module · Checklists & Readiness</div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-[#F2F0EB]">
              Community readiness before the alert threshold triggers
            </h2>
            <p className="mt-2 text-sm text-[#A1A8B0] max-w-[60ch]">
              Local coordinators maintain supply seals, roof tarps, and LoRa radio charge before monsoon onset. Toggle
              village checklist items below to track district readiness.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <label htmlFor="prep-village" className="text-xs text-[#A1A8B0]">
                  Village
                </label>
                <select
                  id="prep-village"
                  value={prepVillageId}
                  onChange={(e) => setPrepVillageId(e.target.value)}
                  className="bg-[#151C24] border border-white/12 rounded-lg px-3 py-2 text-sm text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} — {v.name} ({v.sector})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#ECEAE4]">
                <ShieldCheck className="w-4 h-4 text-[#3C9D6E]" />
                <span>
                  Readiness {readinessPct}% ({completedChecks}/{prepVillage.readinessChecklist.length})
                </span>
              </div>
            </div>

            <div className="mt-4 divide-y divide-white/8 border-b border-white/8">
              {prepVillage.readinessChecklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleChecklistItem(prepVillage.id, item.id)}
                  className="w-full py-3.5 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] px-2 rounded transition-colors"
                >
                  <span className={`text-sm ${item.done ? 'text-[#ECEAE4]' : 'text-[#A1A8B0]'}`}>
                    {item.label}
                  </span>
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                      item.done
                        ? 'bg-[#3C9D6E] border-[#3C9D6E] text-[#0C1014]'
                        : 'border-white/25 bg-transparent'
                    }`}
                  >
                    {item.done && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* District Alert Thresholds & Drill Schedule */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
              <div className="relative h-40 bg-[#18202a]">
                <img
                  src={FIELD_IMAGES.reliefCamp}
                  alt="Humanitarian relief staging camp loading water jerrycans onto a 4x4 truck"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121820] via-black/35 to-transparent" />
                <div className="absolute bottom-3 left-5 text-xs text-[#ECEAE4] font-mono-tabular">
                  Scheduled District Drills · Pre-Monsoon Readiness
                </div>
              </div>

              <div className="p-5 divide-y divide-white/8">
                {DRILL_SCHEDULE.map((d) => (
                  <div key={d.date} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs font-mono-tabular text-[#A1A8B0]">
                      <span>{d.date}</span>
                      <span>{d.sector}</span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-[#ECEAE4]">{d.drill}</div>
                    <div className="mt-0.5 text-xs text-[#6E7782]">Lead Staging: {d.lead}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
