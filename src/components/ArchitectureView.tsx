import React, { useState } from 'react';
import { Download } from 'lucide-react';
import {
  FieldRequest,
  OptimizationResult,
  ROAD_EDGES,
  ReliefCamp,
  SupplyVehicle,
  Village,
} from '../engine/disasterEngine';

interface ArchitectureViewProps {
  villages: Village[];
  camps: ReliefCamp[];
  vehicles: SupplyVehicle[];
  optimization: OptimizationResult;
  offlineQueue: FieldRequest[];
}

const GAP_TO_FEATURE_ROWS = [
  {
    gap: 'Forecasting and optimization are disconnected',
    feature: 'Forecast auto-triggers re-routing',
    implementation:
      'Lightweight quadratic rainfall regression maps 24h precipitation (0–280 mm) to a demand multiplier (1.00x–2.60x) and river surge stage, re-scoring every village and recalculating multi-stop routes automatically.',
  },
  {
    gap: 'Last-mile perception errors distort triage',
    feature: 'Detection confidence feeds priority & spawns verification tasks',
    implementation:
      'YOLOv8 headcount estimates are confidence-weighted inside the priority equation. Any assessment falling under 70% mean confidence automatically appends a Verification Task to the Control Room queue.',
  },
  {
    gap: 'Siloed, synthetic data lacks transparency',
    feature: 'Unified single schema with explicit simulated labeling',
    implementation:
      'All 12 villages, 3 camps, 4 vehicles, road edges, and dispatches share one inspectable relational schema with explicit simulated-data labels and direct JSON/CSV export.',
  },
  {
    gap: 'Communication failure halts supply intake',
    feature: 'Offline queue, SMS fallback, simulated mesh relay',
    implementation:
      'Outage mode stores requests locally, compiles 42-byte SMS fallback strings (MR|V04|W420...), and visualizes multi-hop LoRa relay paths until network sync resumes.',
  },
  {
    gap: 'Black-box routing ignores equity',
    feature: 'Reason text for every dispatch & live fairness score',
    implementation:
      'Each vehicle stop outputs its exact human-readable rationale alongside a district Fairness Score (0–100) and remote-to-highway coverage gap.',
  },
];

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  villages,
  camps,
  vehicles,
  optimization,
  offlineQueue,
}) => {
  const [schemaTab, setSchemaTab] = useState<'villages' | 'camps' | 'vehicles' | 'dispatches' | 'roads'>('villages');

  const schemaData =
    schemaTab === 'villages'
      ? { dataset: 'SIMULATED_KOSI_MECHI_V1', count: villages.length, records: villages }
      : schemaTab === 'camps'
        ? { dataset: 'SIMULATED_KOSI_MECHI_V1', count: camps.length, records: camps }
        : schemaTab === 'vehicles'
          ? { dataset: 'SIMULATED_KOSI_MECHI_V1', count: vehicles.length, records: vehicles }
          : schemaTab === 'roads'
            ? {
                dataset: 'SIMULATED_KOSI_MECHI_V1',
                activeCutEdges: optimization.activeCutEdgeIds,
                records: ROAD_EDGES,
              }
            : {
                dataset: 'SIMULATED_KOSI_MECHI_V1',
                fairnessScore: optimization.fairnessScore,
                demandMultiplier: optimization.forecast.demandMultiplier,
                offlineQueueCount: offlineQueue.length,
                dispatches: optimization.dispatches,
              };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(schemaData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meridian-relief-${schemaTab}-simulated.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const headers = ['Vehicle', 'Camp', 'VillageID', 'VillageName', 'Priority', 'PayloadKg', 'EtaMin', 'Reason'];
    const rows = optimization.dispatches.flatMap((d) =>
      d.stops.map((s) => [
        d.vehicle.callsign,
        d.camp.name,
        s.villageId,
        s.villageName,
        String(s.priorityScore),
        String(s.payloadKg),
        String(s.etaMinutes),
        `"${s.reasonText.replace(/"/g, '""')}"`,
      ])
    );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meridian-relief-dispatches.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-10 space-y-12">
      <div className="pb-6 border-b border-white/10">
        <div className="text-xs text-[#A1A8B0] font-mono-tabular">
          Technical Report · Gap-to-Feature Architecture · Honest Limitations
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-[#F2F0EB]">
          System Architecture, Unified Schema & Limitations
        </h1>
        <p className="mt-2 text-sm text-[#A1A8B0] max-w-[68ch] leading-relaxed">
          Every dataset record in this interactive MVP is explicitly labeled as simulated district telemetry so
          reviewers can inspect both the closed-loop engineering design and the exact boundaries of the prototype.
        </p>
      </div>

      {/* GAP-TO-FEATURE TABLE */}
      <section>
        <h2 className="font-display text-xl font-semibold text-[#F2F0EB]">01. Literature Gap-to-Feature Matrix</h2>
        <div className="mt-4 rounded-xl border border-white/10 bg-[#121820] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-mono-tabular text-[#6E7782]">
                <th className="py-3.5 px-5 font-medium w-[26%]">Identified Literature Gap</th>
                <th className="py-3.5 px-5 font-medium w-[24%]">Implemented Feature</th>
                <th className="py-3.5 px-5 font-medium">Mechanism in Prototype</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {GAP_TO_FEATURE_ROWS.map((row) => (
                <tr key={row.gap} className="align-top">
                  <td className="py-4 px-5 text-[#A1A8B0]">{row.gap}</td>
                  <td className="py-4 px-5 font-medium text-[#ECEAE4]">{row.feature}</td>
                  <td className="py-4 px-5 text-[#D3D6DB] leading-relaxed text-[13.5px]">{row.implementation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* UNIFIED SCHEMA LIVE INSPECTOR */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#F2F0EB]">
              02. Unified Single Schema (Simulated District Data)
            </h2>
            <p className="mt-1 text-xs text-[#A1A8B0]">
              Live snapshot of the Kosi-Mechi flood district schema reflecting your current rainfall, bridge cuts, and
              field requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/meridian-relief-vscode.zip"
              download="meridian-relief-vscode.zip"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#D94E28] text-white rounded-lg hover:bg-[#c54320] transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download VS Code ZIP</span>
            </a>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#18202a] text-[#ECEAE4] border border-white/12 rounded-lg hover:border-white/30 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#ECEAE4] text-[#0C1014] rounded-lg hover:bg-white transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Dispatches CSV</span>
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 bg-[#0f141b]">
            <div className="flex items-center gap-1">
              {(['villages', 'camps', 'vehicles', 'roads', 'dispatches'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSchemaTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                    schemaTab === tab
                      ? 'bg-[#ECEAE4] text-[#0C1014]'
                      : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono-tabular text-[#D49A3A]">
              Dataset Provenance: SIMULATED_KOSI_MECHI_V1
            </span>
          </div>

          <pre className="p-5 text-xs font-mono-tabular text-[#C9D1D9] overflow-x-auto max-h-[340px] leading-relaxed">
            {JSON.stringify(schemaData, null, 2)}
          </pre>
        </div>
      </section>

      {/* HONEST LIMITATIONS & FUTURE WORK */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="rounded-xl border border-white/10 bg-[#121820] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F2F0EB]">03. Honest Limitations of This MVP</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#A1A8B0] leading-relaxed">
            <li>
              <strong className="text-[#ECEAE4] font-medium">Simulated district dataset:</strong> Coordinates,
              elevations, populations, and inventories for the 12 villages, 3 camps, and 4 vehicles are seeded synthetic
              records modeled after monsoon floodplain basins rather than live government telemetry.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">Rainfall regression instead of trained LSTM:</strong>{' '}
              Demand multipliers and river stage forecasts use a deterministic quadratic regression equation rather than
              a multi-year trained hydrological LSTM or watershed runoff simulation.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">Simulated SMS and LoRa mesh layer:</strong> Offline
              packets and multi-hop relay paths demonstrate protocol compression and queue synchronization in software
              without physical GSM modems or Sub-GHz LoRa radio transceivers.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">Client-side vision simulation:</strong> The YOLOv8 intake
              screen reproduces bounding-box confidence weighting and verification gating deterministically in the
              browser so the demonstration operates offline without GPU inference latency.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#121820] p-6">
          <h2 className="font-display text-lg font-semibold text-[#F2F0EB]">04. Scope Cut & Future Work</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#A1A8B0] leading-relaxed">
            <li>
              <strong className="text-[#ECEAE4] font-medium">Live geospatial & weather ingestion:</strong> Replace
              seeded road edges with live OpenStreetMap Overpass graphs and national meteorological gauge feeds.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">Hardware SMS & Meshtastic gateways:</strong> Connect the
              compact SMS encoder to real cellular gateway hardware and field-deployed solar LoRa relay nodes.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">UAV reconnaissance & aerial drops:</strong> Integrate
              autonomous drone corridors for villages whose terrestrial bridges remain severed beyond amphibious reach.
            </li>
            <li>
              <strong className="text-[#ECEAE4] font-medium">Production deployment essentials:</strong> Add role-based
              authentication, regional multilingual interfaces for community coordinators, and long-term post-disaster
              recovery modules.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
