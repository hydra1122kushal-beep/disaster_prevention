import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Radio,
  Send,
  Upload,
} from 'lucide-react';
import {
  FIELD_IMAGES,
  FieldRequest,
  ReliefCamp,
  Village,
  computeMeshHops,
  encodeSmsPayload,
} from '../engine/disasterEngine';

interface FieldIntakeViewProps {
  villages: Village[];
  camps: ReliefCamp[];
  networkDown: boolean;
  onToggleNetworkDown: () => void;
  onSubmitFieldRequest: (req: Omit<FieldRequest, 'id' | 'timestamp' | 'synced'>) => void;
  onApplyVisionDetection: (payload: {
    villageId: string;
    detectedCount: number;
    confidence: number;
    sceneLabel: string;
  }) => void;
  recentRequests: FieldRequest[];
}

interface DetectionBox {
  label: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  baseConf: number;
}

const SAMPLE_SCENES: {
  id: string;
  title: string;
  defaultVillageId: string;
  imageUrl: string;
  boxes: DetectionBox[];
  headcountEstimate: number;
}[] = [
  {
    id: 'flood-rooftop',
    title: 'Flooded Rooftop Shelter',
    defaultVillageId: 'V04',
    imageUrl: FIELD_IMAGES.floodVillage,
    headcountEstimate: 78,
    boxes: [
      { label: 'person_group', xPct: 47, yPct: 55, wPct: 37, hPct: 26, baseConf: 0.91 },
      { label: 'rescue_boat', xPct: 26, yPct: 68, wPct: 12, hPct: 19, baseConf: 0.87 },
      { label: 'submerged_structure', xPct: 20, yPct: 39, wPct: 24, hPct: 16, baseConf: 0.83 },
      { label: 'shelter_tarp', xPct: 44, yPct: 46, wPct: 26, hPct: 17, baseConf: 0.94 },
    ],
  },
  {
    id: 'washed-bridge',
    title: 'Submerged Bridge B2',
    defaultVillageId: 'V05',
    imageUrl: FIELD_IMAGES.washedBridge,
    headcountEstimate: 14,
    boxes: [
      { label: 'bridge_collapse', xPct: 37, yPct: 41, wPct: 45, hPct: 24, baseConf: 0.74 },
      { label: 'person', xPct: 22, yPct: 44, wPct: 13, hPct: 42, baseConf: 0.86 },
      { label: 'landslide_debris', xPct: 3, yPct: 20, wPct: 29, hPct: 31, baseConf: 0.66 },
    ],
  },
  {
    id: 'relief-camp',
    title: 'High-Ground Staging Camp',
    defaultVillageId: 'V01',
    imageUrl: FIELD_IMAGES.reliefCamp,
    headcountEstimate: 26,
    boxes: [
      { label: 'relief_vehicle', xPct: 59, yPct: 48, wPct: 37, hPct: 29, baseConf: 0.95 },
      { label: 'water_jerrycans', xPct: 49, yPct: 73, wPct: 31, hPct: 20, baseConf: 0.92 },
      { label: 'medical_crates', xPct: 27, yPct: 74, wPct: 23, hPct: 21, baseConf: 0.89 },
      { label: 'coordinator', xPct: 37, yPct: 53, wPct: 12, hPct: 25, baseConf: 0.91 },
    ],
  },
];

export const FieldIntakeView: React.FC<FieldIntakeViewProps> = ({
  villages,
  camps,
  networkDown,
  onToggleNetworkDown,
  onSubmitFieldRequest,
  onApplyVisionDetection,
  recentRequests,
}) => {
  // Supply request form state
  const [villageId, setVillageId] = useState('V04');
  const [waterLiters, setWaterLiters] = useState(420);
  const [foodKits, setFoodKits] = useState(110);
  const [medicalPacks, setMedicalPacks] = useState(35);
  const [shelterTarps, setShelterTarps] = useState(40);
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'critical'>('urgent');
  const [note, setNote] = useState('Rising water near east culvert; 18 elderly residents on concrete school roof.');
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // YOLOv8 simulator state
  const [selectedSampleId, setSelectedSampleId] = useState(SAMPLE_SCENES[0].id);
  const [customUploadUrl, setCustomUploadUrl] = useState<string | null>(null);
  const [occlusionPct, setOcclusionPct] = useState(12); // 0 to 65% rain/fog occlusion
  const [visionAppliedMsg, setVisionAppliedMsg] = useState<string | null>(null);

  const activeSample = SAMPLE_SCENES.find((s) => s.id === selectedSampleId) || SAMPLE_SCENES[0];
  const displayImageUrl = customUploadUrl || activeSample.imageUrl;

  const adjustedDetections = useMemo(() => {
    const degradation = occlusionPct * 0.0068;
    return activeSample.boxes.map((b) => ({
      ...b,
      conf: Math.max(0.32, Number((b.baseConf - degradation).toFixed(2))),
    }));
  }, [activeSample, occlusionPct]);

  const meanConfidence = useMemo(() => {
    const avg = adjustedDetections.reduce((acc, d) => acc + d.conf, 0) / adjustedDetections.length;
    return Number(avg.toFixed(2));
  }, [adjustedDetections]);

  const triggersVerification = meanConfidence < 0.7;

  const smsPreview = useMemo(
    () =>
      encodeSmsPayload({
        villageId,
        waterLiters,
        foodKits,
        medicalPacks,
        shelterTarps,
        urgency,
      }),
    [villageId, waterLiters, foodKits, medicalPacks, shelterTarps, urgency]
  );

  const meshHops = useMemo(() => computeMeshHops(villageId, villages, camps), [villageId, villages, camps]);

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitFieldRequest({
      villageId,
      waterLiters,
      foodKits,
      medicalPacks,
      shelterTarps,
      urgency,
      note,
      transportMode: networkDown ? 'mesh-relay' : 'online',
      smsPayload: smsPreview,
      meshHops,
    });
    setSubmitFeedback(
      networkDown
        ? `Stored in offline queue & relayed via ${meshHops.length - 1}-hop mesh (${smsPreview})`
        : `Dispatched live to priority optimizer for ${villageId}`
    );
    window.setTimeout(() => setSubmitFeedback(null), 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomUploadUrl(url);
    setVisionAppliedMsg(null);
  };

  const handleApplyVision = () => {
    const scaledCount = Math.max(8, Math.round(activeSample.headcountEstimate * (1 - occlusionPct * 0.004)));
    onApplyVisionDetection({
      villageId,
      detectedCount: scaledCount,
      confidence: meanConfidence,
      sceneLabel: customUploadUrl ? 'Uploaded Field Photo' : activeSample.title,
    });
    setVisionAppliedMsg(
      triggersVerification
        ? `Applied (${Math.round(meanConfidence * 100)}% conf) — low confidence created a Verification Task in Control Room.`
        : `Applied (${scaledCount} detected, ${Math.round(meanConfidence * 100)}% conf) — priority score updated live.`
    );
  };

  return (
    <div className="mx-auto max-w-[1380px] px-6 lg:px-10 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="text-xs text-[#A1A8B0] font-mono-tabular">
            Mobile-First Field Intake · Pretrained YOLOv8 Assessment · Offline Queue
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.02em] text-[#F2F0EB]">
            Field Supply Request & Vision Perception
          </h1>
        </div>

        <button
          type="button"
          onClick={onToggleNetworkDown}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 self-start md:self-auto ${
            networkDown
              ? 'bg-[#D49A3A] border-[#D49A3A] text-[#0C1014]'
              : 'bg-[#171E27] border-white/12 text-[#ECEAE4] hover:border-white/25'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{networkDown ? 'Offline Mode Active (SMS + Mesh)' : 'Simulate Network Outage'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: FIELD SUPPLY REQUEST FORM */}
        <form
          onSubmit={handleRequestSubmit}
          className="lg:col-span-5 rounded-xl border border-white/10 bg-[#121820] p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#F2F0EB]">Supply Request Intake</h2>
            <span className="text-xs font-mono-tabular text-[#A1A8B0]">
              {networkDown ? 'Offline Queue' : 'Direct Sync'}
            </span>
          </div>

          <div>
            <label htmlFor="intake-village" className="block text-xs text-[#A1A8B0] mb-1.5">
              Target Village
            </label>
            <select
              id="intake-village"
              value={villageId}
              onChange={(e) => setVillageId(e.target.value)}
              className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} — {v.name} ({v.sector} · Pop {v.population})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="req-water" className="block text-xs text-[#A1A8B0] mb-1">
                Water (Liters)
              </label>
              <input
                id="req-water"
                type="number"
                min={0}
                max={3000}
                step={20}
                value={waterLiters}
                onChange={(e) => setWaterLiters(Number(e.target.value))}
                className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2 text-sm font-mono-tabular text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
              />
            </div>
            <div>
              <label htmlFor="req-food" className="block text-xs text-[#A1A8B0] mb-1">
                Food Kits
              </label>
              <input
                id="req-food"
                type="number"
                min={0}
                max={1000}
                step={10}
                value={foodKits}
                onChange={(e) => setFoodKits(Number(e.target.value))}
                className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2 text-sm font-mono-tabular text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
              />
            </div>
            <div>
              <label htmlFor="req-med" className="block text-xs text-[#A1A8B0] mb-1">
                Medical Packs
              </label>
              <input
                id="req-med"
                type="number"
                min={0}
                max={300}
                step={5}
                value={medicalPacks}
                onChange={(e) => setMedicalPacks(Number(e.target.value))}
                className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2 text-sm font-mono-tabular text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
              />
            </div>
            <div>
              <label htmlFor="req-tarp" className="block text-xs text-[#A1A8B0] mb-1">
                Shelter Tarps
              </label>
              <input
                id="req-tarp"
                type="number"
                min={0}
                max={300}
                step={5}
                value={shelterTarps}
                onChange={(e) => setShelterTarps(Number(e.target.value))}
                className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2 text-sm font-mono-tabular text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-[#A1A8B0] mb-1.5">Urgency Tier</div>
            <div className="grid grid-cols-3 gap-1.5 bg-[#0d1218] p-1 rounded-lg border border-white/10">
              {(['routine', 'urgent', 'critical'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setUrgency(tier)}
                  className={`py-2 text-xs font-medium rounded-md capitalize transition-colors ${
                    urgency === tier
                      ? tier === 'critical'
                        ? 'bg-[#D94E28] text-white'
                        : 'bg-[#ECEAE4] text-[#0C1014]'
                      : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="req-note" className="block text-xs text-[#A1A8B0] mb-1">
              Ground Observation Note
            </label>
            <textarea
              id="req-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#0d1218] border border-white/12 rounded-lg px-3 py-2 text-sm text-[#ECEAE4] focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* Live SMS Fallback & Mesh Packet Preview */}
          <div className="rounded-lg bg-[#0d1218] border border-white/8 p-3.5 space-y-1.5">
            <div className="text-[11px] text-[#6E7782]">
              Simulated SMS Fallback ({smsPreview.length} bytes) & Mesh Hop Route
            </div>
            <div className="font-mono-tabular text-xs text-[#D49A3A] break-all">{smsPreview}</div>
            <div className="font-mono-tabular text-[11px] text-[#A1A8B0]">
              Relay Path: {meshHops.join(' -> ')}
            </div>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[#D94E28] text-white rounded-lg hover:bg-[#c54320] transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>{networkDown ? 'Queue Offline & Transmit via Mesh' : 'Submit Supply Request'}</span>
          </button>

          {submitFeedback && (
            <div className="flex items-start gap-2 text-xs text-[#3C9D6E] pt-1">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitFeedback}</span>
            </div>
          )}
        </form>

        {/* RIGHT COLUMN: PRETRAINED YOLOV8 ASSESSMENT & CONFIDENCE GATE */}
        <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#121820] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F2F0EB]">
                YOLOv8 Last-Mile Image Assessment
              </h2>
              <p className="text-xs text-[#A1A8B0] mt-0.5">
                Detected count and confidence feed directly into priority scoring. Confidence below 70% opens a
                verification task.
              </p>
            </div>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#18202a] text-[#ECEAE4] border border-white/12 rounded-lg hover:border-white/30 cursor-pointer transition-colors whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Sample Documentary Photo Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0d1218] p-1 rounded-lg border border-white/10">
            {SAMPLE_SCENES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setCustomUploadUrl(null);
                  setSelectedSampleId(sample.id);
                  setVillageId(sample.defaultVillageId);
                  setVisionAppliedMsg(null);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  !customUploadUrl && selectedSampleId === sample.id
                    ? 'bg-[#ECEAE4] text-[#0C1014]'
                    : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                {sample.title}
              </button>
            ))}
          </div>

          {/* Image Viewport with Precision YOLOv8 Bounding Boxes */}
          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-white/10 bg-[#0b0f14]">
            <img
              src={displayImageUrl}
              alt="Field disaster photograph under YOLOv8 bounding box analysis"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-[filter] duration-200"
              style={{
                filter: `brightness(${1 - occlusionPct * 0.0055}) contrast(${1 - occlusionPct * 0.006}) blur(${(
                  occlusionPct * 0.045
                ).toFixed(1)}px)`,
              }}
            />

            {/* Simulated Monsoon Mist Overlay proportional to occlusion slider */}
            {occlusionPct > 15 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#8aa1ad]"
                style={{ opacity: Math.min(0.42, (occlusionPct - 15) * 0.007) }}
              />
            )}

            {/* Bounding Boxes */}
            {adjustedDetections.map((box, i) => {
              const low = box.conf < 0.7;
              const strokeColor = low ? '#D49A3A' : '#3C9D6E';
              return (
                <div
                  key={`${box.label}-${i}`}
                  className="pointer-events-none absolute border-2"
                  style={{
                    left: `${box.xPct}%`,
                    top: `${box.yPct}%`,
                    width: `${box.wPct}%`,
                    height: `${box.hPct}%`,
                    borderColor: strokeColor,
                    backgroundColor: low ? 'rgba(212, 154, 58, 0.12)' : 'rgba(60, 157, 110, 0.09)',
                  }}
                >
                  <div
                    className="inline-block px-1.5 py-0.5 text-[10px] font-mono-tabular font-medium text-[#0C1014]"
                    style={{ backgroundColor: strokeColor }}
                  >
                    {box.label} {box.conf.toFixed(2)}
                  </div>
                </div>
              );
            })}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-[#0c1014]/90 border border-white/10 rounded-md px-3 py-2 text-xs font-mono-tabular">
              <span className="text-[#ECEAE4]">
                Detections: {adjustedDetections.length} · Est. People:{' '}
                {Math.max(8, Math.round(activeSample.headcountEstimate * (1 - occlusionPct * 0.004)))}
              </span>
              <span className={triggersVerification ? 'text-[#D49A3A] font-medium' : 'text-[#3C9D6E] font-medium'}>
                Mean Conf {Math.round(meanConfidence * 100)}% {triggersVerification ? '(Below 70% Gate)' : '(Nominal)'}
              </span>
            </div>
          </div>

          {/* Fog / Rain Occlusion Degradation Slider (for live low-confidence demo) */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#A1A8B0]">Simulate Rain / Fog Visibility Degradation</span>
              <span className="font-mono-tabular text-[#ECEAE4]">{occlusionPct}% occlusion</span>
            </div>
            <input
              type="range"
              min={0}
              max={65}
              step={1}
              value={occlusionPct}
              onChange={(e) => {
                setOcclusionPct(Number(e.target.value));
                setVisionAppliedMsg(null);
              }}
              aria-label="Simulated visibility occlusion percentage"
              className="meridian-slider w-full"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/8">
            <div className="flex items-center gap-2 text-xs">
              {triggersVerification ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#D49A3A] shrink-0" />
                  <span className="text-[#D49A3A]">
                    Confidence below 0.70 — applying will create a Control Room verification task.
                  </span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-[#3C9D6E] shrink-0" />
                  <span className="text-[#A1A8B0]">
                    High-confidence assessment ready to weight village {villageId} priority.
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleApplyVision}
              className="px-4 py-2 text-xs font-medium bg-[#ECEAE4] text-[#0C1014] rounded-lg hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              Apply Detection to {villageId}
            </button>
          </div>

          {visionAppliedMsg && (
            <div className="text-xs text-[#ECEAE4] bg-[#0d1218] border border-white/10 rounded-lg px-3.5 py-2.5">
              {visionAppliedMsg}
            </div>
          )}
        </div>
      </div>

      {/* Recent Intake Log */}
      {recentRequests.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 text-sm font-display font-semibold text-[#F2F0EB]">
            Recent Field Requests & Offline Queue Log
          </div>
          <div className="divide-y divide-white/8">
            {recentRequests.map((r) => (
              <div key={r.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-mono-tabular text-[#ECEAE4] font-medium">{r.villageId}</span>
                  <span className="mx-2 text-[#6E7782]">·</span>
                  <span className="text-[#A1A8B0]">
                    {r.waterLiters}L water, {r.foodKits} food, {r.medicalPacks} med, {r.shelterTarps} tarps
                  </span>
                  <div className="mt-0.5 text-[#6E7782] font-mono-tabular">SMS: {r.smsPayload}</div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className={r.synced ? 'text-[#3C9D6E]' : 'text-[#D49A3A]'}>
                    {r.synced ? 'Synced to Optimizer' : 'Queued Offline (Mesh Relay)'}
                  </div>
                  <div className="text-[#6E7782]">{r.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
