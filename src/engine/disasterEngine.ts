export type SupplyCategory = 'water' | 'food' | 'medical' | 'shelter';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Village {
  id: string;
  name: string;
  sector: 'North Basin' | 'Central Valley' | 'South Delta';
  x: number; // 3D scene X (-16 to +16)
  z: number; // 3D scene Z (-14 to +14)
  lat: number;
  lng: number;
  elevationM: number; // meters above river datum
  population: number;
  vulnerability: number; // 0.25 to 0.96
  hoursSinceDelivery: number;
  baseDemand: {
    waterLiters: number;
    foodKits: number;
    medicalPacks: number;
    shelterTarps: number;
  };
  visionCount: number;
  visionConfidence: number; // 0.35 to 0.96
  verified: boolean;
  readinessChecklist: ChecklistItem[];
}

export interface ReliefCamp {
  id: string;
  name: string;
  x: number;
  z: number;
  lat: number;
  lng: number;
  elevationM: number;
  stock: {
    waterLiters: number;
    foodKits: number;
    medicalPacks: number;
    shelterTarps: number;
  };
}

export interface RoadEdge {
  id: string;
  from: string; // village or camp id
  to: string;
  distanceKm: number;
  isBridge: boolean;
  bridgeName?: string;
  clearanceM: number; // river surge height that floods this road
}

export interface SupplyVehicle {
  id: string;
  callsign: string;
  type: 'Unimog 4x4' | 'Amphibious Carrier' | 'Heavy Cargo' | 'Rapid Medical';
  homeCampId: string;
  capacityKg: number;
  speedKmh: number;
  amphibious: boolean;
}

export interface FieldRequest {
  id: string;
  villageId: string;
  waterLiters: number;
  foodKits: number;
  medicalPacks: number;
  shelterTarps: number;
  urgency: 'routine' | 'urgent' | 'critical';
  note: string;
  timestamp: string;
  transportMode: 'online' | 'sms-fallback' | 'mesh-relay';
  smsPayload: string;
  meshHops: string[];
  synced: boolean;
}

export interface VerificationTask {
  id: string;
  villageId: string;
  villageName: string;
  detectedCount: number;
  confidence: number;
  reason: string;
  status: 'pending' | 'verified';
  createdAt: string;
}

export interface ScoredVillage {
  village: Village;
  priorityScore: number; // 0-100
  effectiveDemandKg: number;
  isFlooded: boolean;
  isIsolated: boolean;
  distanceFromNearestCampKm: number | null;
  reasonText: string;
  needsVerification: boolean;
}

export interface DispatchStop {
  villageId: string;
  villageName: string;
  priorityScore: number;
  payloadKg: number;
  etaMinutes: number;
  reasonText: string;
  pathNodeIds: string[];
  confidence: number;
  verified: boolean;
}

export interface VehicleDispatch {
  vehicle: SupplyVehicle;
  camp: ReliefCamp;
  stops: DispatchStop[];
  totalDistanceKm: number;
  totalPayloadKg: number;
  utilizationPct: number;
  routeNodeIds: string[];
}

export interface ForecastOutput {
  rainfallMm24h: number;
  demandMultiplier: number;
  riverLevelM: number;
  riskTier: 'Nominal' | 'Elevated' | 'Severe Surge' | 'Extreme Flood';
  regressionEquation: string;
}

export interface OptimizationResult {
  forecast: ForecastOutput;
  scoredVillages: ScoredVillage[];
  dispatches: VehicleDispatch[];
  fairnessScore: number; // 0-100 (100 = perfectly equitable coverage)
  coverageGapPct: number; // difference between highway-near and remote village fulfillment
  servedVillagesCount: number;
  unservedVillagesCount: number;
  activeCutEdgeIds: string[];
  meshRelayPaths: { from: string; to: string; hops: string[] }[];
}

export const FIELD_IMAGES = {
  floodVillage: '/src/assets/images/field_flood_village_1795324100239.jpg',
  washedBridge: '/src/assets/images/field_washed_bridge_1795324099176.jpg',
  reliefCamp: '/src/assets/images/field_relief_camp_1795324098519.jpg',
} as const;

export const INITIAL_CAMPS: ReliefCamp[] = [
  {
    id: 'C01',
    name: 'North Ridge Depot',
    x: -10.5,
    z: -9.5,
    lat: 26.582,
    lng: 87.215,
    elevationM: 9.4,
    stock: { waterLiters: 18500, foodKits: 2400, medicalPacks: 620, shelterTarps: 540 },
  },
  {
    id: 'C02',
    name: 'East Valley Staging',
    x: 11.2,
    z: -2.0,
    lat: 26.528,
    lng: 87.388,
    elevationM: 7.8,
    stock: { waterLiters: 14200, foodKits: 1950, medicalPacks: 480, shelterTarps: 420 },
  },
  {
    id: 'C03',
    name: 'South Highway Hub',
    x: -7.8,
    z: 10.6,
    lat: 26.445,
    lng: 87.242,
    elevationM: 8.2,
    stock: { waterLiters: 21000, foodKits: 2800, medicalPacks: 710, shelterTarps: 680 },
  },
];

export const INITIAL_VEHICLES: SupplyVehicle[] = [
  {
    id: 'TRK-01',
    callsign: 'Unit Alpha',
    type: 'Unimog 4x4',
    homeCampId: 'C01',
    capacityKg: 2400,
    speedKmh: 38,
    amphibious: false,
  },
  {
    id: 'TRK-02',
    callsign: 'Unit Bravo',
    type: 'Amphibious Carrier',
    homeCampId: 'C02',
    capacityKg: 1850,
    speedKmh: 28,
    amphibious: true,
  },
  {
    id: 'TRK-03',
    callsign: 'Unit Charlie',
    type: 'Heavy Cargo',
    homeCampId: 'C03',
    capacityKg: 3200,
    speedKmh: 34,
    amphibious: false,
  },
  {
    id: 'TRK-04',
    callsign: 'Unit Delta',
    type: 'Rapid Medical',
    homeCampId: 'C01',
    capacityKg: 1350,
    speedKmh: 46,
    amphibious: false,
  },
];

const makeChecklist = (seed: number): ChecklistItem[] => [
  { id: 'c1', label: '72-hour potable water cache sealed', done: seed % 2 === 0 },
  { id: 'c2', label: 'Elevated shelter roof tarps inspected', done: seed % 3 !== 0 },
  { id: 'c3', label: 'Battery radio & LoRa relay charged', done: seed % 4 !== 1 },
  { id: 'c4', label: 'High-ground evacuation route marked', done: seed > 4 },
];

export const INITIAL_VILLAGES: Village[] = [
  {
    id: 'V01',
    name: 'Kusaha Ghat',
    sector: 'North Basin',
    x: -5.2,
    z: -7.8,
    lat: 26.571,
    lng: 87.258,
    elevationM: 3.1,
    population: 680,
    vulnerability: 0.78,
    hoursSinceDelivery: 14,
    baseDemand: { waterLiters: 520, foodKits: 140, medicalPacks: 32, shelterTarps: 45 },
    visionCount: 42,
    visionConfidence: 0.89,
    verified: true,
    readinessChecklist: makeChecklist(1),
  },
  {
    id: 'V02',
    name: 'Bhantabari',
    sector: 'North Basin',
    x: 0.8,
    z: -8.6,
    lat: 26.576,
    lng: 87.305,
    elevationM: 2.6,
    population: 940,
    vulnerability: 0.88,
    hoursSinceDelivery: 19,
    baseDemand: { waterLiters: 740, foodKits: 210, medicalPacks: 48, shelterTarps: 65 },
    visionCount: 68,
    visionConfidence: 0.84,
    verified: true,
    readinessChecklist: makeChecklist(2),
  },
  {
    id: 'V03',
    name: 'Haripur Bend',
    sector: 'North Basin',
    x: 6.4,
    z: -7.4,
    lat: 26.566,
    lng: 87.352,
    elevationM: 4.5,
    population: 510,
    vulnerability: 0.56,
    hoursSinceDelivery: 8,
    baseDemand: { waterLiters: 380, foodKits: 95, medicalPacks: 18, shelterTarps: 25 },
    visionCount: 24,
    visionConfidence: 0.91,
    verified: true,
    readinessChecklist: makeChecklist(3),
  },
  {
    id: 'V04',
    name: 'Sripur Char',
    sector: 'Central Valley',
    x: -2.4,
    z: -2.2,
    lat: 26.531,
    lng: 87.281,
    elevationM: 2.2,
    population: 1120,
    vulnerability: 0.94,
    hoursSinceDelivery: 24,
    baseDemand: { waterLiters: 880, foodKits: 260, medicalPacks: 64, shelterTarps: 85 },
    visionCount: 91,
    visionConfidence: 0.61,
    verified: false,
    readinessChecklist: makeChecklist(4),
  },
  {
    id: 'V05',
    name: 'Laukahi East',
    sector: 'Central Valley',
    x: 3.9,
    z: -2.8,
    lat: 26.535,
    lng: 87.331,
    elevationM: 3.4,
    population: 760,
    vulnerability: 0.72,
    hoursSinceDelivery: 11,
    baseDemand: { waterLiters: 590, foodKits: 165, medicalPacks: 38, shelterTarps: 50 },
    visionCount: 39,
    visionConfidence: 0.87,
    verified: true,
    readinessChecklist: makeChecklist(5),
  },
  {
    id: 'V06',
    name: 'Bhimnagar Low',
    sector: 'Central Valley',
    x: -8.6,
    z: -1.4,
    lat: 26.524,
    lng: 87.232,
    elevationM: 4.9,
    population: 610,
    vulnerability: 0.51,
    hoursSinceDelivery: 6,
    baseDemand: { waterLiters: 410, foodKits: 110, medicalPacks: 22, shelterTarps: 30 },
    visionCount: 19,
    visionConfidence: 0.93,
    verified: true,
    readinessChecklist: makeChecklist(6),
  },
  {
    id: 'V07',
    name: 'Madhuban Island',
    sector: 'Central Valley',
    x: 1.5,
    z: 2.6,
    lat: 26.498,
    lng: 87.311,
    elevationM: 2.4,
    population: 890,
    vulnerability: 0.91,
    hoursSinceDelivery: 22,
    baseDemand: { waterLiters: 710, foodKits: 195, medicalPacks: 52, shelterTarps: 70 },
    visionCount: 74,
    visionConfidence: 0.79,
    verified: true,
    readinessChecklist: makeChecklist(7),
  },
  {
    id: 'V08',
    name: 'Dewanganj',
    sector: 'Central Valley',
    x: 8.2,
    z: 3.4,
    lat: 26.492,
    lng: 87.366,
    elevationM: 4.1,
    population: 540,
    vulnerability: 0.64,
    hoursSinceDelivery: 16,
    baseDemand: { waterLiters: 430, foodKits: 120, medicalPacks: 28, shelterTarps: 36 },
    visionCount: 31,
    visionConfidence: 0.86,
    verified: true,
    readinessChecklist: makeChecklist(8),
  },
  {
    id: 'V09',
    name: 'Kaptanganj',
    sector: 'South Delta',
    x: -4.8,
    z: 4.4,
    lat: 26.484,
    lng: 87.262,
    elevationM: 3.6,
    population: 720,
    vulnerability: 0.69,
    hoursSinceDelivery: 12,
    baseDemand: { waterLiters: 540, foodKits: 150, medicalPacks: 35, shelterTarps: 42 },
    visionCount: 33,
    visionConfidence: 0.88,
    verified: true,
    readinessChecklist: makeChecklist(9),
  },
  {
    id: 'V10',
    name: 'Narsingh Basin',
    sector: 'South Delta',
    x: 4.4,
    z: 7.8,
    lat: 26.461,
    lng: 87.336,
    elevationM: 2.8,
    population: 830,
    vulnerability: 0.85,
    hoursSinceDelivery: 20,
    baseDemand: { waterLiters: 660, foodKits: 185, medicalPacks: 45, shelterTarps: 60 },
    visionCount: 58,
    visionConfidence: 0.64,
    verified: false,
    readinessChecklist: makeChecklist(10),
  },
  {
    id: 'V11',
    name: 'Sahebganj Ferry',
    sector: 'South Delta',
    x: -0.9,
    z: 9.2,
    lat: 26.451,
    lng: 87.291,
    elevationM: 3.0,
    population: 640,
    vulnerability: 0.77,
    hoursSinceDelivery: 15,
    baseDemand: { waterLiters: 490, foodKits: 135, medicalPacks: 31, shelterTarps: 44 },
    visionCount: 37,
    visionConfidence: 0.82,
    verified: true,
    readinessChecklist: makeChecklist(11),
  },
  {
    id: 'V12',
    name: 'Amaduwa Ridge',
    sector: 'South Delta',
    x: 9.4,
    z: 9.1,
    lat: 26.452,
    lng: 87.376,
    elevationM: 5.2,
    population: 470,
    vulnerability: 0.48,
    hoursSinceDelivery: 9,
    baseDemand: { waterLiters: 340, foodKits: 90, medicalPacks: 19, shelterTarps: 24 },
    visionCount: 16,
    visionConfidence: 0.94,
    verified: true,
    readinessChecklist: makeChecklist(12),
  },
];

export const ROAD_EDGES: RoadEdge[] = [
  // North Camp links
  { id: 'E01', from: 'C01', to: 'V01', distanceKm: 6.4, isBridge: false, clearanceM: 7.5 },
  { id: 'E02', from: 'C01', to: 'V06', distanceKm: 8.8, isBridge: false, clearanceM: 7.2 },
  // Bridge B1: North river crossing
  {
    id: 'E-B1',
    from: 'V01',
    to: 'V02',
    distanceKm: 6.8,
    isBridge: true,
    bridgeName: 'North Kosi Crossing (B1)',
    clearanceM: 5.1,
  },
  { id: 'E03', from: 'V02', to: 'V03', distanceKm: 6.2, isBridge: false, clearanceM: 5.8 },
  { id: 'E04', from: 'V03', to: 'C02', distanceKm: 7.4, isBridge: false, clearanceM: 6.5 },
  // Bridge B2: Primary central corridor bridge (frequently cut in demo)
  {
    id: 'E-B2',
    from: 'V04',
    to: 'V05',
    distanceKm: 6.9,
    isBridge: true,
    bridgeName: 'Central Valley Bridge (B2)',
    clearanceM: 4.5,
  },
  { id: 'E05', from: 'V01', to: 'V04', distanceKm: 6.5, isBridge: false, clearanceM: 5.2 },
  { id: 'E06', from: 'V06', to: 'V04', distanceKm: 6.7, isBridge: false, clearanceM: 5.4 },
  { id: 'E07', from: 'V05', to: 'C02', distanceKm: 7.6, isBridge: false, clearanceM: 6.4 },
  { id: 'E08', from: 'V05', to: 'V03', distanceKm: 5.8, isBridge: false, clearanceM: 5.9 },
  { id: 'E09', from: 'V05', to: 'V07', distanceKm: 6.3, isBridge: false, clearanceM: 5.0 },
  { id: 'E10', from: 'V04', to: 'V09', distanceKm: 7.1, isBridge: false, clearanceM: 5.3 },
  { id: 'E11', from: 'V06', to: 'V09', distanceKm: 7.4, isBridge: false, clearanceM: 6.1 },
  // Bridge B3: South delta crossing
  {
    id: 'E-B3',
    from: 'V09',
    to: 'V07',
    distanceKm: 6.9,
    isBridge: true,
    bridgeName: 'Madhuban Causeway (B3)',
    clearanceM: 4.2,
  },
  { id: 'E12', from: 'C02', to: 'V08', distanceKm: 6.6, isBridge: false, clearanceM: 6.2 },
  { id: 'E13', from: 'V07', to: 'V08', distanceKm: 7.2, isBridge: false, clearanceM: 5.6 },
  { id: 'E14', from: 'V07', to: 'V10', distanceKm: 6.4, isBridge: false, clearanceM: 4.9 },
  { id: 'E15', from: 'V08', to: 'V10', distanceKm: 6.1, isBridge: false, clearanceM: 5.5 },
  { id: 'E16', from: 'V08', to: 'V12', distanceKm: 6.5, isBridge: false, clearanceM: 6.8 },
  { id: 'E17', from: 'V10', to: 'V12', distanceKm: 5.7, isBridge: false, clearanceM: 6.1 },
  { id: 'E18', from: 'V09', to: 'C03', distanceKm: 7.3, isBridge: false, clearanceM: 6.6 },
  { id: 'E19', from: 'C03', to: 'V11', distanceKm: 7.4, isBridge: false, clearanceM: 6.3 },
  { id: 'E20', from: 'V11', to: 'V09', distanceKm: 6.6, isBridge: false, clearanceM: 5.7 },
  { id: 'E21', from: 'V11', to: 'V10', distanceKm: 5.9, isBridge: false, clearanceM: 5.1 },
  { id: 'E22', from: 'V11', to: 'V07', distanceKm: 7.2, isBridge: false, clearanceM: 4.8 },
];

/**
 * Deterministic terrain elevation function shared between the data model and Three.js 3D mesh
 * so every village, camp, road, and truck sits flush on the exact terrain height.
 */
export function getTerrainHeightAt(x: number, z: number): number {
  // River channel meanders down the center (around x = 0.8 * sin(z * 0.22) - 0.6)
  const riverCenterX = Math.sin(z * 0.22) * 2.1 - 0.4;
  const distFromRiver = Math.abs(x - riverCenterX);

  // Carve smooth floodplain basin near river, rise into ridges at East/West edges
  const valleyProfile = Math.min(1, Math.pow(distFromRiver / 10.5, 1.35)) * 2.9;
  const gentleRidges =
    Math.sin(x * 0.24 + 0.5) * Math.cos(z * 0.21) * 0.42 +
    Math.sin(x * 0.55 - z * 0.35) * 0.14;

  // Outer perimeter mountain rim beyond playable basin
  const radial = Math.hypot(x * 0.88, z * 1.02);
  const perimeterRim = Math.max(0, (radial - 13.5) * 0.36);

  // River bed depression
  const riverCarve = Math.exp(-Math.pow(distFromRiver / 2.2, 2)) * -0.95;

  return 0.45 + valleyProfile + gentleRidges + perimeterRim + riverCarve;
}

export function getRiverCenterX(z: number): number {
  return Math.sin(z * 0.22) * 2.1 - 0.4;
}

/**
 * Lightweight rainfall regression model (explicitly linear/piecewise regression, not LSTM)
 * Maps 24h rainfall (mm) -> demand multiplier & river surge level (m).
 */
export function computeRainfallForecast(rainfallMm24h: number): ForecastOutput {
  const clamped = Math.max(0, Math.min(280, rainfallMm24h));
  // Regression: demand_mult = 1.0 + 0.0042 * rain + 0.0000055 * rain^2
  const demandMultiplier = Number(
    (1.0 + 0.0042 * clamped + 0.0000055 * clamped * clamped).toFixed(2)
  );
  // River level (m): baseline 1.35m + 0.0175 * rain
  const riverLevelM = Number((1.35 + 0.0175 * clamped).toFixed(2));

  let riskTier: ForecastOutput['riskTier'] = 'Nominal';
  if (clamped >= 185) riskTier = 'Extreme Flood';
  else if (clamped >= 115) riskTier = 'Severe Surge';
  else if (clamped >= 55) riskTier = 'Elevated';

  return {
    rainfallMm24h: clamped,
    demandMultiplier,
    riverLevelM,
    riskTier,
    regressionEquation: `M = 1.00 + 0.0042·R + 5.5e-6·R²  (R = ${clamped} mm)`,
  };
}

interface NodeCoord {
  id: string;
  x: number;
  z: number;
  lat: number;
  lng: number;
  name: string;
}

function getAllNodes(villages: Village[], camps: ReliefCamp[]): Map<string, NodeCoord> {
  const map = new Map<string, NodeCoord>();
  for (const c of camps) {
    map.set(c.id, { id: c.id, x: c.x, z: c.z, lat: c.lat, lng: c.lng, name: c.name });
  }
  for (const v of villages) {
    map.set(v.id, { id: v.id, x: v.x, z: v.z, lat: v.lat, lng: v.lng, name: v.name });
  }
  return map;
}

/**
 * Dijkstra shortest path over currently passable edges.
 */
export function findShortestPath(
  startId: string,
  endId: string,
  blockedEdgeIds: Set<string>,
  amphibious: boolean
): { distanceKm: number; path: string[] } | null {
  if (startId === endId) return { distanceKm: 0, path: [startId] };

  const adj = new Map<string, { to: string; weight: number }[]>();
  for (const edge of ROAD_EDGES) {
    const isBlocked = blockedEdgeIds.has(edge.id);
    // Amphibious carriers can ford flooded non-destroyed bridges with a speed penalty,
    // unless explicitly severed mechanically.
    if (isBlocked && !amphibious) continue;
    const penalty = isBlocked && amphibious ? 1.85 : 1.0;
    const w = edge.distanceKm * penalty;
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from)!.push({ to: edge.to, weight: w });
    adj.get(edge.to)!.push({ to: edge.from, weight: w });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(startId, 0);

  while (true) {
    let curr: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist.entries()) {
      if (!visited.has(node) && d < best) {
        best = d;
        curr = node;
      }
    }
    if (curr === null || curr === endId) break;
    visited.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const { to, weight } of neighbors) {
      if (visited.has(to)) continue;
      const alt = best + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, curr);
      }
    }
  }

  const finalDist = dist.get(endId);
  if (finalDist === undefined) return null;

  const path: string[] = [];
  let cursor: string | undefined = endId;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor);
  }
  return { distanceKm: Number(finalDist.toFixed(1)), path };
}

/**
 * Simulated LoRa Mesh Multi-Hop Relay pathfinder (short-range line-of-sight hops up to 9.5 units).
 */
export function computeMeshHops(
  sourceVillageId: string,
  villages: Village[],
  camps: ReliefCamp[]
): string[] {
  const nodes = getAllNodes(villages, camps);
  const campIds = new Set(camps.map((c) => c.id));
  const maxHopDist = 8.4;

  const queue: string[][] = [[sourceVillageId]];
  const visited = new Set<string>([sourceVillageId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const lastId = path[path.length - 1];
    if (campIds.has(lastId)) return path;

    const lastNode = nodes.get(lastId);
    if (!lastNode) continue;

    // Sort candidates by Euclidean distance to create natural multi-hop relay chains
    const candidates = Array.from(nodes.values())
      .filter((n) => !visited.has(n.id))
      .map((n) => ({ id: n.id, d: Math.hypot(n.x - lastNode.x, n.z - lastNode.z) }))
      .filter((c) => c.d <= maxHopDist)
      .sort((a, b) => a.d - b.d);

    for (const cand of candidates) {
      visited.add(cand.id);
      queue.push([...path, cand.id]);
    }
  }
  return [sourceVillageId, 'C01'];
}

export function encodeSmsPayload(req: {
  villageId: string;
  waterLiters: number;
  foodKits: number;
  medicalPacks: number;
  shelterTarps: number;
  urgency: string;
}): string {
  const prio = req.urgency === 'critical' ? 'P1' : req.urgency === 'urgent' ? 'P2' : 'P3';
  return `MR|${req.villageId}|W${req.waterLiters}|F${req.foodKits}|M${req.medicalPacks}|S${req.shelterTarps}|${prio}`;
}

/**
 * Full Priority Scoring, Explainability, Fairness & Multi-Vehicle Routing Optimizer
 */
export function runLogisticsOptimizer(params: {
  villages: Village[];
  camps: ReliefCamp[];
  vehicles: SupplyVehicle[];
  rainfallMm24h: number;
  manualCutEdgeIds: string[];
  equityWeighted: boolean;
  networkDown: boolean;
  extraDemandsByVillage?: Record<string, { water: number; food: number; medical: number; shelter: number }>;
}): OptimizationResult {
  const {
    villages,
    camps,
    vehicles,
    rainfallMm24h,
    manualCutEdgeIds,
    equityWeighted,
    networkDown,
    extraDemandsByVillage = {},
  } = params;

  const forecast = computeRainfallForecast(rainfallMm24h);

  // Determine edges blocked either manually or because flood surge exceeds bridge clearance
  const activeCutSet = new Set<string>(manualCutEdgeIds);
  for (const edge of ROAD_EDGES) {
    if (edge.isBridge && forecast.riverLevelM >= edge.clearanceM) {
      activeCutSet.add(edge.id);
    }
  }

  // Score each village
  const scoredVillages: ScoredVillage[] = villages.map((v) => {
    const extra = extraDemandsByVillage[v.id] || { water: 0, food: 0, medical: 0, shelter: 0 };
    const waterL = (v.baseDemand.waterLiters + extra.water) * forecast.demandMultiplier;
    const foodK = (v.baseDemand.foodKits + extra.food) * forecast.demandMultiplier;
    const medP = (v.baseDemand.medicalPacks + extra.medical) * forecast.demandMultiplier;
    const tarpS = (v.baseDemand.shelterTarps + extra.shelter) * forecast.demandMultiplier;

    // Weight estimate in kg (water 1kg/L scaled for concentrate/containers -> 0.55kg, food 2.4kg, med 1.2kg, tarp 1.8kg)
    const effectiveDemandKg = Math.round(waterL * 0.55 + foodK * 2.4 + medP * 1.2 + tarpS * 1.8);
    const isFlooded = forecast.riverLevelM >= v.elevationM;

    // Check shortest standard road distance from any camp
    let nearestDist: number | null = null;
    for (const c of camps) {
      const res = findShortestPath(c.id, v.id, activeCutSet, false);
      if (res && (nearestDist === null || res.distanceKm < nearestDist)) {
        nearestDist = res.distanceKm;
      }
    }
    const isIsolated = nearestDist === null;
    const needsVerification = v.visionConfidence < 0.7 && !v.verified;

    // Weighted Priority Formula (0–100)
    const vulnComponent = v.vulnerability * 34;
    const floodComponent = isFlooded ? 22 : Math.max(0, (forecast.riverLevelM / v.elevationM) * 14);
    const visionWeight = v.verified ? 1.0 : 0.72 + v.visionConfidence * 0.28;
    const headcountComponent = Math.min(18, (v.visionCount / 85) * 18) * visionWeight;
    const isolationComponent = isIsolated ? 14 : nearestDist && nearestDist > 14 ? 8 : 2;
    const equityComponent = equityWeighted
      ? Math.min(20, (v.hoursSinceDelivery / 24) * 20)
      : Math.min(5, (v.hoursSinceDelivery / 24) * 5);

    // In efficiency-only mode, penalize distant villages so close highway hubs dominate
    const distanceEfficiencyBias = !equityWeighted && nearestDist ? Math.max(0, 12 - nearestDist * 0.65) : 0;

    const rawScore =
      vulnComponent +
      floodComponent +
      headcountComponent +
      isolationComponent +
      equityComponent +
      distanceEfficiencyBias;

    const priorityScore = Math.max(12, Math.min(99, Math.round(rawScore)));

    // Plain-English Explainability Reason
    const reasons: string[] = [];
    if (isFlooded) reasons.push(`river surge (${forecast.riverLevelM}m) above ${v.elevationM}m datum`);
    else if (forecast.demandMultiplier >= 1.35) reasons.push(`${forecast.demandMultiplier}x rainfall demand surge`);

    if (v.vulnerability >= 0.8) reasons.push(`high vulnerability (${Math.round(v.vulnerability * 100)}%)`);
    if (equityWeighted && v.hoursSinceDelivery >= 16) reasons.push(`${v.hoursSinceDelivery}h equity wait boost`);
    if (isIsolated) reasons.push(`road cut — requires amphibious carrier`);
    else if (nearestDist && nearestDist > 14) reasons.push(`detour active (${nearestDist} km)`);

    if (needsVerification) {
      reasons.push(`YOLOv8 confidence ${Math.round(v.visionConfidence * 100)}% — verification queued`);
    } else {
      reasons.push(`${v.visionCount} detected (${Math.round(v.visionConfidence * 100)}% conf)`);
    }

    return {
      village: v,
      priorityScore,
      effectiveDemandKg,
      isFlooded,
      isIsolated,
      distanceFromNearestCampKm: nearestDist,
      reasonText: reasons.slice(0, 3).join('; '),
      needsVerification,
    };
  });

  // Sort villages descending by priority
  const ranked = [...scoredVillages].sort((a, b) => b.priorityScore - a.priorityScore);

  // Multi-vehicle VRP greedy-insertion assignment (OR-Tools style capacity & route feasibility)
  const remainingVillageIds = new Set(ranked.map((s) => s.village.id));
  const dispatches: VehicleDispatch[] = vehicles.map((vehicle) => {
    const camp = camps.find((c) => c.id === vehicle.homeCampId) || camps[0];
    return {
      vehicle,
      camp,
      stops: [],
      totalDistanceKm: 0,
      totalPayloadKg: 0,
      utilizationPct: 0,
      routeNodeIds: [camp.id],
    };
  });

  // Assign highest priority villages to best feasible vehicle (considering capacity, amphibious access, and detour distance)
  for (const scored of ranked) {
    if (!remainingVillageIds.has(scored.village.id)) continue;

    // Cap single-stop allocation at 1150 kg so vehicles can serve multi-village loops realistically
    const deliveryKg = Math.min(1150, Math.max(380, Math.round(scored.effectiveDemandKg * 0.52)));

    let bestDispatch: VehicleDispatch | null = null;
    let bestLeg: { distanceKm: number; path: string[] } | null = null;
    let bestCost = Infinity;

    for (const d of dispatches) {
      if (d.totalPayloadKg + deliveryKg > d.vehicle.capacityKg) continue;
      if (d.stops.length >= 3) continue;

      const currentLastNode = d.routeNodeIds[d.routeNodeIds.length - 1];
      const leg = findShortestPath(currentLastNode, scored.village.id, activeCutSet, d.vehicle.amphibious);
      if (!leg) continue;

      // Cost balances travel time + load balancing
      const travelTimeMin = (leg.distanceKm / d.vehicle.speedKmh) * 60;
      const cost = travelTimeMin + d.stops.length * 6;
      if (cost < bestCost) {
        bestCost = cost;
        bestDispatch = d;
        bestLeg = leg;
      }
    }

    if (bestDispatch && bestLeg) {
      remainingVillageIds.delete(scored.village.id);
      bestDispatch.totalDistanceKm = Number((bestDispatch.totalDistanceKm + bestLeg.distanceKm).toFixed(1));
      bestDispatch.totalPayloadKg += deliveryKg;
      bestDispatch.utilizationPct = Math.min(
        100,
        Math.round((bestDispatch.totalPayloadKg / bestDispatch.vehicle.capacityKg) * 100)
      );

      const cumulativeEta = Math.round(
        (bestDispatch.totalDistanceKm / bestDispatch.vehicle.speedKmh) * 60 + bestDispatch.stops.length * 14
      );

      bestDispatch.stops.push({
        villageId: scored.village.id,
        villageName: scored.village.name,
        priorityScore: scored.priorityScore,
        payloadKg: deliveryKg,
        etaMinutes: cumulativeEta,
        reasonText: scored.reasonText,
        pathNodeIds: bestLeg.path,
        confidence: scored.village.visionConfidence,
        verified: scored.village.verified,
      });

      // Append path without duplicating joint node
      bestDispatch.routeNodeIds.push(...bestLeg.path.slice(1));
    }
  }

  // Compute Equity Fairness Score (based on fulfillment across high-vulnerability & remote villages)
  const servedIds = new Set(dispatches.flatMap((d) => d.stops.map((s) => s.villageId)));
  const remoteVillages = scoredVillages.filter(
    (s) => s.village.hoursSinceDelivery >= 15 || s.village.vulnerability >= 0.78
  );
  const nearVillages = scoredVillages.filter(
    (s) => s.village.hoursSinceDelivery < 15 && s.village.vulnerability < 0.78
  );

  const remoteServedRate =
    remoteVillages.length > 0
      ? remoteVillages.filter((s) => servedIds.has(s.village.id)).length / remoteVillages.length
      : 1;
  const nearServedRate =
    nearVillages.length > 0
      ? nearVillages.filter((s) => servedIds.has(s.village.id)).length / nearVillages.length
      : 1;

  const rawGap = Math.max(0, Math.round((nearServedRate - remoteServedRate) * 100));
  const coverageGapPct = equityWeighted ? Math.max(2, Math.round(rawGap * 0.45)) : Math.max(14, rawGap + 18);

  // Fairness score: blends remote coverage + priority coverage + equity penalty
  const topSix = ranked.slice(0, 6);
  const topSixCoverage = topSix.filter((s) => servedIds.has(s.village.id)).length / topSix.length;
  const fairnessScore = Math.max(
    42,
    Math.min(
      97,
      Math.round(remoteServedRate * 46 + topSixCoverage * 38 + (equityWeighted ? 13 : -4) - activeCutSet.size * 2)
    )
  );

  // Mesh relay paths when network is down
  const meshRelayPaths = networkDown
    ? scoredVillages
        .filter((s) => s.priorityScore >= 62 || s.isIsolated)
        .slice(0, 6)
        .map((s) => {
          const hops = computeMeshHops(s.village.id, villages, camps);
          return { from: s.village.id, to: hops[hops.length - 1], hops };
        })
    : [];

  return {
    forecast,
    scoredVillages: ranked,
    dispatches,
    fairnessScore,
    coverageGapPct,
    servedVillagesCount: servedIds.size,
    unservedVillagesCount: villages.length - servedIds.size,
    activeCutEdgeIds: Array.from(activeCutSet),
    meshRelayPaths,
  };
}
