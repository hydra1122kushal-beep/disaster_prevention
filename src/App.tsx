import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import {
  FieldRequest,
  INITIAL_CAMPS,
  INITIAL_VEHICLES,
  INITIAL_VILLAGES,
  VerificationTask,
  Village,
  computeMeshHops,
  encodeSmsPayload,
  runLogisticsOptimizer,
} from './engine/disasterEngine';
import { AppView, OverviewView } from './components/OverviewView';
import { BasinScene3D } from './components/BasinScene3D';
import { ControlRoomView } from './components/ControlRoomView';
import { FieldIntakeView } from './components/FieldIntakeView';
import { ArchitectureView } from './components/ArchitectureView';

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'basin', label: '3D Basin' },
  { id: 'control', label: 'Control Room' },
  { id: 'intake', label: 'Field Intake' },
  { id: 'report', label: 'Report' },
];

export default function App() {
  const prefersReducedMotion = useReducedMotion();

  const [activeView, setActiveView] = useState<AppView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unified reactive state shared across 3D Basin, Leaflet Map, Control Room, Intake & Report
  const [villages, setVillages] = useState<Village[]>(INITIAL_VILLAGES);
  const [rainfallMm, setRainfallMm] = useState<number>(85);
  const [manualCutEdges, setManualCutEdges] = useState<string[]>([]);
  const [equityWeighted, setEquityWeighted] = useState<boolean>(true);
  const [networkDown, setNetworkDown] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('baseline');

  const [offlineQueue, setOfflineQueue] = useState<FieldRequest[]>([]);
  const [extraDemands, setExtraDemands] = useState<
    Record<string, { water: number; food: number; medical: number; shelter: number }>
  >({});

  const [verificationTasks, setVerificationTasks] = useState<VerificationTask[]>([
    {
      id: 'VT-01',
      villageId: 'V04',
      villageName: 'Sripur Char',
      detectedCount: 91,
      confidence: 0.61,
      reason: 'Heavy monsoon haze reduced rooftop detection confidence below 70% threshold.',
      status: 'pending',
      createdAt: '09:14',
    },
    {
      id: 'VT-02',
      villageId: 'V10',
      villageName: 'Narsingh Basin',
      detectedCount: 58,
      confidence: 0.64,
      reason: 'Tree canopy occlusion on delta embankment photo; confirm shelter headcount.',
      status: 'pending',
      createdAt: '09:28',
    },
  ]);

  const optimization = useMemo(
    () =>
      runLogisticsOptimizer({
        villages,
        camps: INITIAL_CAMPS,
        vehicles: INITIAL_VEHICLES,
        rainfallMm24h: rainfallMm,
        manualCutEdgeIds: manualCutEdges,
        equityWeighted,
        networkDown,
        extraDemandsByVillage: extraDemands,
      }),
    [villages, rainfallMm, manualCutEdges, equityWeighted, networkDown, extraDemands]
  );

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const handleToggleCutBridge = (edgeId: string) => {
    setManualCutEdges((prev) =>
      prev.includes(edgeId) ? prev.filter((id) => id !== edgeId) : [...prev, edgeId]
    );
  };

  const handleToggleChecklistItem = (villageId: string, itemId: string) => {
    setVillages((prev) =>
      prev.map((v) =>
        v.id !== villageId
          ? v
          : {
              ...v,
              readinessChecklist: v.readinessChecklist.map((c) =>
                c.id === itemId ? { ...c, done: !c.done } : c
              ),
            }
      )
    );
  };

  const handleSubmitFieldRequest = (req: Omit<FieldRequest, 'id' | 'timestamp' | 'synced'>) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const synced = !networkDown;
    const entry: FieldRequest = {
      ...req,
      id: `REQ-${Date.now().toString().slice(-4)}`,
      timestamp: timeStr,
      synced,
    };
    setOfflineQueue((prev) => [entry, ...prev]);

    if (synced) {
      setExtraDemands((prev) => {
        const cur = prev[req.villageId] || { water: 0, food: 0, medical: 0, shelter: 0 };
        return {
          ...prev,
          [req.villageId]: {
            water: cur.water + req.waterLiters,
            food: cur.food + req.foodKits,
            medical: cur.medical + req.medicalPacks,
            shelter: cur.shelter + req.shelterTarps,
          },
        };
      });
    }
  };

  const handleFlushOfflineQueue = () => {
    const unsynced = offlineQueue.filter((q) => !q.synced);
    if (unsynced.length > 0) {
      setExtraDemands((prev) => {
        const next = { ...prev };
        for (const req of unsynced) {
          const cur = next[req.villageId] || { water: 0, food: 0, medical: 0, shelter: 0 };
          next[req.villageId] = {
            water: cur.water + req.waterLiters,
            food: cur.food + req.foodKits,
            medical: cur.medical + req.medicalPacks,
            shelter: cur.shelter + req.shelterTarps,
          };
        }
        return next;
      });
      setOfflineQueue((prev) => prev.map((q) => ({ ...q, synced: true })));
    }
    setNetworkDown(false);
  };

  const handleApplyVisionDetection = (payload: {
    villageId: string;
    detectedCount: number;
    confidence: number;
    sceneLabel: string;
  }) => {
    const isLowConf = payload.confidence < 0.7;
    setVillages((prev) =>
      prev.map((v) =>
        v.id !== payload.villageId
          ? v
          : {
              ...v,
              visionCount: payload.detectedCount,
              visionConfidence: payload.confidence,
              verified: !isLowConf,
            }
      )
    );

    if (isLowConf) {
      const target = villages.find((v) => v.id === payload.villageId);
      const timeStr = new Date().toTimeString().slice(0, 5);
      setVerificationTasks((prev) => [
        {
          id: `VT-${Date.now().toString().slice(-3)}`,
          villageId: payload.villageId,
          villageName: target ? target.name : payload.villageId,
          detectedCount: payload.detectedCount,
          confidence: payload.confidence,
          reason: `${payload.sceneLabel} scored ${Math.round(payload.confidence * 100)}% confidence (<70% gate).`,
          status: 'pending',
          createdAt: timeStr,
        },
        ...prev.filter((t) => t.villageId !== payload.villageId || t.status === 'verified'),
      ]);
    }
  };

  const handleResolveVerificationTask = (taskId: string, villageId: string) => {
    setVerificationTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'verified' } : t))
    );
    setVillages((prev) =>
      prev.map((v) => (v.id === villageId ? { ...v, verified: true } : v))
    );
  };

  const handleApplyDemoPreset = (preset: 'baseline' | 'surge' | 'lowconf' | 'cutbridge' | 'outage') => {
    setActivePreset(preset);
    if (preset === 'baseline') {
      setRainfallMm(85);
      setManualCutEdges([]);
      setNetworkDown(false);
      setEquityWeighted(true);
    } else if (preset === 'surge') {
      setRainfallMm(210);
      setManualCutEdges([]);
      setNetworkDown(false);
    } else if (preset === 'lowconf') {
      setRainfallMm(125);
      handleApplyVisionDetection({
        villageId: 'V07',
        detectedCount: 82,
        confidence: 0.56,
        sceneLabel: 'Monsoon Haze Rooftop Scan',
      });
      setSelectedNodeId('V07');
    } else if (preset === 'cutbridge') {
      setRainfallMm(135);
      setManualCutEdges(['E-B2']);
      setSelectedNodeId('V04');
    } else if (preset === 'outage') {
      setRainfallMm(155);
      setNetworkDown(true);
      const vId = 'V04';
      const payload = encodeSmsPayload({
        villageId: vId,
        waterLiters: 520,
        foodKits: 140,
        medicalPacks: 45,
        shelterTarps: 50,
        urgency: 'critical',
      });
      const hops = computeMeshHops(vId, villages, INITIAL_CAMPS);
      setOfflineQueue((prev) => {
        if (prev.some((p) => !p.synced && p.villageId === vId)) return prev;
        return [
          {
            id: `REQ-MESH-${Date.now().toString().slice(-3)}`,
            villageId: vId,
            waterLiters: 520,
            foodKits: 140,
            medicalPacks: 45,
            shelterTarps: 50,
            urgency: 'critical',
            note: 'Tower outage in Central Valley; relayed over village LoRa hops.',
            timestamp: new Date().toTimeString().slice(0, 5),
            transportMode: 'mesh-relay',
            smsPayload: payload,
            meshHops: hops,
            synced: false,
          },
          ...prev,
        ];
      });
    }
  };

  // 3D Spatial Perspective Transition Variants (compositor-only transform + opacity)
  const viewTransition = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: {
          opacity: 0,
          rotateX: 4.5,
          y: 22,
          scale: 0.985,
        },
        animate: {
          opacity: 1,
          rotateX: 0,
          y: 0,
          scale: 1,
        },
        exit: {
          opacity: 0,
          rotateX: -3.5,
          y: -14,
          scale: 0.99,
        },
        transition: {
          duration: 0.34,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      };

  return (
    <div className="min-h-screen flex flex-col bg-[#0C1014] text-[#ECEAE4]">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-40 bg-[#0C1014]/95 border-b border-white/10">
        <div className="mx-auto max-w-[1440px] h-16 px-6 lg:px-10 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="font-display text-lg font-semibold tracking-[-0.02em] text-[#F2F0EB] whitespace-nowrap shrink-0 hover:text-white transition-colors"
          >
            Meridian Relief
          </button>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-[#F2F0EB]' : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#D94E28]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA button (+ mobile menu button on narrow screens) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate(activeView === 'basin' ? 'control' : 'basin')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-medium bg-[#ECEAE4] text-[#0C1014] rounded-lg hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              {activeView === 'basin' ? 'Open Control Room' : 'Launch 3D Basin'}
            </button>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden p-2 text-[#ECEAE4] border border-white/12 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation sheet */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0F141B] px-6 py-4 flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`text-left py-2 text-sm font-medium ${
                  activeView === item.id ? 'text-[#D94E28]' : 'text-[#A1A8B0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 3D PERSPECTIVE VIEWPORT STAGE */}
      <main className="flex-1 perspective-stage overflow-x-clip">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={viewTransition.initial}
            animate={viewTransition.animate}
            exit={viewTransition.exit}
            transition={viewTransition.transition}
            className="w-full h-full preserve-3d"
            style={{ transformOrigin: '50% 18%' }}
          >
            {activeView === 'overview' && (
              <OverviewView
                villages={villages}
                camps={INITIAL_CAMPS}
                optimization={optimization}
                rainfallMm={rainfallMm}
                onRainfallChange={setRainfallMm}
                manualCutEdges={manualCutEdges}
                onToggleCutBridge={handleToggleCutBridge}
                networkDown={networkDown}
                onToggleNetworkDown={() => setNetworkDown((n) => !n)}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onNavigate={handleNavigate}
                onToggleChecklistItem={handleToggleChecklistItem}
                onApplyDemoPreset={handleApplyDemoPreset}
              />
            )}

            {activeView === 'basin' && (
              <div className="w-full h-[calc(100vh-4rem)] min-h-[600px]">
                <BasinScene3D
                  villages={villages}
                  camps={INITIAL_CAMPS}
                  optimization={optimization}
                  rainfallMm={rainfallMm}
                  onRainfallChange={setRainfallMm}
                  manualCutEdges={manualCutEdges}
                  onToggleCutBridge={handleToggleCutBridge}
                  networkDown={networkDown}
                  onToggleNetworkDown={() => setNetworkDown((n) => !n)}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </div>
            )}

            {activeView === 'control' && (
              <ControlRoomView
                villages={villages}
                camps={INITIAL_CAMPS}
                optimization={optimization}
                rainfallMm={rainfallMm}
                onRainfallChange={setRainfallMm}
                manualCutEdges={manualCutEdges}
                onToggleCutBridge={handleToggleCutBridge}
                equityWeighted={equityWeighted}
                onToggleEquityWeighted={setEquityWeighted}
                networkDown={networkDown}
                onToggleNetworkDown={() => setNetworkDown((n) => !n)}
                offlineQueue={offlineQueue}
                onFlushOfflineQueue={handleFlushOfflineQueue}
                verificationTasks={verificationTasks}
                onResolveVerificationTask={handleResolveVerificationTask}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onApplyDemoPreset={handleApplyDemoPreset}
                activePreset={activePreset}
              />
            )}

            {activeView === 'intake' && (
              <FieldIntakeView
                villages={villages}
                camps={INITIAL_CAMPS}
                networkDown={networkDown}
                onToggleNetworkDown={() => setNetworkDown((n) => !n)}
                onSubmitFieldRequest={handleSubmitFieldRequest}
                onApplyVisionDetection={handleApplyVisionDetection}
                recentRequests={offlineQueue}
              />
            )}

            {activeView === 'report' && (
              <ArchitectureView
                villages={villages}
                camps={INITIAL_CAMPS}
                vehicles={INITIAL_VEHICLES}
                optimization={optimization}
                offlineQueue={offlineQueue}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* QUIET EDITORIAL FOOTER (Hidden in full-bleed 3D Basin mode so viewport stays 100% unobstructed) */}
      {activeView !== 'basin' && (
        <footer className="border-t border-white/10 bg-[#0A0E12]">
          <div className="mx-auto max-w-[1380px] px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6E7782]">
            <div>
              <span className="text-[#A1A8B0] font-medium">Meridian Relief</span>
              <span className="mx-2">·</span>
              <span>Simulated Kosi-Mechi Flood District Prototype (12 Villages, 3 Camps, 4 Vehicles)</span>
            </div>
            <div className="flex items-center gap-5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className="hover:text-[#ECEAE4] transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
