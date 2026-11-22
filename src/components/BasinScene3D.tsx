import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Radio,
  RotateCcw,
  Scissors,
  Truck,
  Waves,
} from 'lucide-react';
import {
  OptimizationResult,
  ROAD_EDGES,
  ReliefCamp,
  Village,
  getRiverCenterX,
  getTerrainHeightAt,
} from '../engine/disasterEngine';

export type CameraPreset = 'basin' | 'valley' | 'follow' | 'topographic';

interface BasinScene3DProps {
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
  compactHero?: boolean;
}

// Reusable scratch objects outside render loop (zero GC churn)
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _vCamTarget = new THREE.Vector3();
const _vLookTarget = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createTopographicTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const worldSpan = 58;
  const half = worldSpan / 2;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let py = 0; py < size; py++) {
    const z = (py / (size - 1)) * worldSpan - half;
    for (let px = 0; px < size; px++) {
      const x = (px / (size - 1)) * worldSpan - half;
      const h = getTerrainHeightAt(x, z);

      // Subtle mineral topographic gradient: deep silt valley -> mossy slate -> basalt ridge
      let r = 24;
      let g = 32;
      let b = 38;

      if (h < 0.7) {
        // Riverbed silt
        r = 18;
        g = 28;
        b = 34;
      } else if (h < 2.1) {
        const t = (h - 0.7) / 1.4;
        r = 25 + t * 14;
        g = 36 + t * 16;
        b = 39 + t * 11;
      } else if (h < 4.2) {
        const t = (h - 2.1) / 2.1;
        r = 39 + t * 20;
        g = 52 + t * 14;
        b = 50 + t * 14;
      } else {
        const t = Math.min(1, (h - 4.2) / 3.5);
        r = 59 + t * 28;
        g = 66 + t * 25;
        b = 64 + t * 26;
      }

      // Crisp topographic contour isolines every 0.45m elevation
      const contourFreq = h / 0.45;
      const frac = Math.abs(contourFreq - Math.round(contourFreq));
      if (frac < 0.036) {
        const major = Math.round(contourFreq) % 4 === 0;
        const boost = major ? 28 : 13;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost + 3);
        b = Math.min(255, b + boost + 5);
      }

      // Fine cartographic survey grid every 4 world units
      const gx = Math.abs(((x + 40) % 4) - 2);
      const gz = Math.abs(((z + 40) % 4) - 2);
      if (gx < 0.03 || gz < 0.03) {
        r = Math.min(255, r + 7);
        g = Math.min(255, g + 9);
        b = Math.min(255, b + 11);
      }

      const idx = (py * size + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildVillageGroup(village: Village): {
  group: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
  hitMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = `village-${village.id}`;

  // 1. Grounded stone plinth (extends slightly below 0 so steep slopes never show gaps)
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x2d343c,
    roughness: 0.9,
    metalness: 0.08,
  });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.42, 8), plinthMat);
  plinth.position.y = -0.08;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  // 2. Primary community shelter hall
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd9d5cc,
    roughness: 0.82,
    metalness: 0.05,
  });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.4), wallMat);
  hall.position.set(-0.08, 0.3, 0.05);
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // 3. Pitched corrugated roof (distinct metallic sheen)
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x4b5c6b,
    roughness: 0.42,
    metalness: 0.55,
  });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.24, 4), roofMat);
  roof.position.set(-0.08, 0.59, 0.05);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.06, 1, 0.82);
  roof.castShadow = true;
  group.add(roof);

  // 4. Secondary clinic/storage house
  const annex = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.28), wallMat);
  annex.position.set(0.28, 0.24, -0.18);
  annex.castShadow = true;
  group.add(annex);

  // 5. Elevated water tank cylinder + support frame
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x7b8894,
    roughness: 0.36,
    metalness: 0.72,
  });
  const tankStand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.42, 6), steelMat);
  tankStand.position.set(0.3, 0.34, 0.24);
  group.add(tankStand);

  const tankDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), steelMat);
  tankDrum.position.set(0.3, 0.58, 0.24);
  tankDrum.castShadow = true;
  group.add(tankDrum);

  // 6. Tilted solar array panel (dark photovoltaic sheen)
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x16293d,
    roughness: 0.18,
    metalness: 0.82,
  });
  const solar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.18), solarMat);
  solar.position.set(-0.34, 0.28, -0.26);
  solar.rotation.x = 0.38;
  group.add(solar);

  // 7. Priority telemetry spire & indicator lantern
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.95, 6), steelMat);
  spire.position.set(0, 0.6, -0.36);
  group.add(spire);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x3c9d6e,
    emissive: 0x3c9d6e,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.2,
  });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), beaconMat);
  beacon.position.set(0, 1.12, -0.36);
  group.add(beacon);

  // Simplified collision proxy on layer 1 for crisp raycasting
  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 1.45, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.65;
  hitMesh.userData = { nodeId: village.id, nodeType: 'village' };
  hitMesh.layers.set(1);
  group.add(hitMesh);

  return { group, beaconMat, hitMesh };
}

function buildCampGroup(camp: ReliefCamp): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = `camp-${camp.id}`;

  // 1. Concrete operations pad
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x262d36,
    roughness: 0.88,
    metalness: 0.1,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 0.44, 12), padMat);
  pad.position.y = -0.08;
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Geodesic / arched supply hangar
  const hangarMat = new THREE.MeshStandardMaterial({
    color: 0xeae6dc,
    roughness: 0.62,
    metalness: 0.12,
  });
  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.95, 14, 1, false, 0, Math.PI),
    hangarMat
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(-0.28, 0.14, -0.1);
  hangar.castShadow = true;
  group.add(hangar);

  // 3. Vermilion relief stripe along hangar arch
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd94e28,
    roughness: 0.45,
    metalness: 0.18,
  });
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.475, 0.475, 0.18, 14, 1, false, 0, Math.PI),
    stripeMat
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.rotation.y = Math.PI / 2;
  stripe.position.set(-0.28, 0.14, -0.1);
  group.add(stripe);

  // 4. Helipad ring & center H bars
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd49a3a,
    roughness: 0.4,
    metalness: 0.35,
  });
  const heliRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.032, 8, 24), ringMat);
  heliRing.rotation.x = Math.PI / 2;
  heliRing.position.set(0.46, 0.16, 0.25);
  group.add(heliRing);

  // 5. Stacked supply crate pallets (water blue & wood)
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x3b8ea5,
    roughness: 0.5,
    metalness: 0.22,
  });
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), crateMat);
    crate.position.set(0.44 + (i - 1) * 0.24, 0.22, -0.42);
    crate.castShadow = true;
    group.add(crate);
  }

  // 6. Communications lattice mast + parabolic dish + signal beacon
  const mastMat = new THREE.MeshStandardMaterial({
    color: 0x9aa6b2,
    roughness: 0.32,
    metalness: 0.85,
  });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.075, 1.55, 6), mastMat);
  mast.position.set(-0.62, 0.9, -0.52);
  mast.castShadow = true;
  group.add(mast);

  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), mastMat);
  dish.position.set(-0.52, 1.25, -0.52);
  dish.rotation.z = -Math.PI / 2.6;
  group.add(dish);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0x3b8ea5,
    emissive: 0x3b8ea5,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), capMat);
  cap.position.set(-0.62, 1.72, -0.52);
  group.add(cap);

  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 1.9, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.85;
  hitMesh.userData = { nodeId: camp.id, nodeType: 'camp' };
  hitMesh.layers.set(1);
  group.add(hitMesh);

  return { group, hitMesh };
}

function buildTruckGroup(isAmphibious: boolean): THREE.Group {
  const group = new THREE.Group();

  // 1. Heavy steel chassis frame
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.72,
    metalness: 0.48,
  });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.74), chassisMat);
  chassis.position.y = 0.14;
  chassis.castShadow = true;
  group.add(chassis);

  // 2. Armored cab
  const cabMat = new THREE.MeshStandardMaterial({
    color: isAmphibious ? 0xd49a3a : 0xedeae2,
    roughness: 0.35,
    metalness: 0.32,
  });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.24), cabMat);
  cab.position.set(0, 0.28, 0.22);
  cab.castShadow = true;
  group.add(cab);

  // 3. Tinted glass windshield
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f1a24,
    roughness: 0.12,
    metalness: 0.9,
  });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.04), glassMat);
  windshield.position.set(0, 0.31, 0.33);
  group.add(windshield);

  // 4. Canvas cargo canopy
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xd9d4c7,
    roughness: 0.86,
    metalness: 0.04,
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.44), canopyMat);
  canopy.position.set(0, 0.31, -0.14);
  canopy.castShadow = true;
  group.add(canopy);

  // 5. High-vis rescue stripe band
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd94e28,
    emissive: 0xd94e28,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.335, 0.06, 0.45), stripeMat);
  band.position.set(0, 0.28, -0.14);
  group.add(band);

  // 6-9. Four rugged off-road wheels
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    roughness: 0.92,
    metalness: 0.1,
  });
  const wheelGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.08, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelCoords: [number, number][] = [
    [-0.17, 0.22],
    [0.17, 0.22],
    [-0.17, -0.22],
    [0.17, -0.22],
  ];
  for (const [wx, wz] of wheelCoords) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.1, wz);
    group.add(w);
  }

  // 10. Dual warm LED headlights
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: 0xffd584,
    emissiveIntensity: 1.4,
  });
  const leftLamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), lampMat);
  leftLamp.position.set(-0.09, 0.22, 0.35);
  group.add(leftLamp);
  const rightLamp = leftLamp.clone();
  rightLamp.position.x = 0.09;
  group.add(rightLamp);

  return group;
}

export const BasinScene3D: React.FC<BasinScene3DProps> = ({
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
  compactHero = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('basin');
  const [exploded, setExploded] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [webglError, setWebglError] = useState(false);

  // Store latest reactive state in ref so WebGL loop never tears down on prop changes
  const stateRef = useRef({
    villages,
    camps,
    optimization,
    rainfallMm,
    networkDown,
    selectedNodeId,
    cameraPreset,
    exploded,
    onSelectNode,
  });
  stateRef.current = {
    villages,
    camps,
    optimization,
    rainfallMm,
    networkDown,
    selectedNodeId,
    cameraPreset,
    exploded,
    onSelectNode,
  };

  // Signal camera transition when preset or selected node changes
  const camTransitionRef = useRef<{ active: boolean; preset: CameraPreset; focusId: string | null }>({
    active: false,
    preset: 'basin',
    focusId: null,
  });

  useEffect(() => {
    camTransitionRef.current = { active: true, preset: cameraPreset, focusId: selectedNodeId };
  }, [cameraPreset, selectedNodeId]);

  // Keyboard shortcut 'H' to toggle Zen/Cinema dock collapse
  useEffect(() => {
    if (compactHero) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compactHero]);

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mountEl.clientWidth || 800, mountEl.clientHeight || 500);
    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x0c1117;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.0155);

    // Mandatory studio environment map for metallic & physical reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      (mountEl.clientWidth || 800) / (mountEl.clientHeight || 500),
      0.2,
      180
    );
    camera.position.set(17.5, 14.5, 20.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.minPolarAngle = 0.22;
    controls.minDistance = 8;
    controls.maxDistance = 42;
    controls.target.set(0, 1.2, 0.5);
    controls.addEventListener('start', () => {
      camTransitionRef.current.active = false;
    });

    // Three-point warm/cool outdoor studio lighting rig
    const hemi = new THREE.HemisphereLight(0x8cb8db, 0x20272e, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff0d9, 1.85);
    keyLight.position.set(18, 26, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x63a6c9, 0.72);
    rimLight.position.set(-20, 11, -18);
    scene.add(rimLight);

    // 1. Sculpted Watershed Terrain (extended to 58x58 natural mountain rim so zero boxed edges)
    const terrainSpan = 58;
    const terrainSegs = 116;
    const terrainGeo = new THREE.PlaneGeometry(terrainSpan, terrainSpan, terrainSegs, terrainSegs);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeightAt(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const topoTex = createTopographicTexture(renderer.capabilities.getMaxAnisotropy());
    const terrainMat = new THREE.MeshStandardMaterial({
      map: topoTex,
      roughness: 0.88,
      metalness: 0.06,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Subtle instanced conifer trees scattered along dry upper ridges (ground-snapped, tinted variation)
    const treeCount = 110;
    const trunkGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.36, 5);
    trunkGeo.translate(0, 0.18, 0);
    const foliageGeo = new THREE.ConeGeometry(0.24, 0.68, 6);
    foliageGeo.translate(0, 0.62, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b312a, roughness: 0.92 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x294438, roughness: 0.84 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let placedTrees = 0;
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    let attempts = 0;
    while (placedTrees < treeCount && attempts < 1400) {
      attempts++;
      const tx = (rand() - 0.5) * 40;
      const tz = (rand() - 0.5) * 38;
      const th = getTerrainHeightAt(tx, tz);
      // Only place on hillsides above flood basin and clear of river & settlements
      if (th < 2.25) continue;
      let tooClose = false;
      for (const v of stateRef.current.villages) {
        if (Math.hypot(tx - v.x, tz - v.z) < 2.1) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      for (const c of stateRef.current.camps) {
        if (Math.hypot(tx - c.x, tz - c.z) < 2.6) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      const sc = 0.82 + rand() * 0.42;
      dummy.position.set(tx, th - 0.04, tz);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(sc, sc * (0.9 + rand() * 0.25), sc);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(placedTrees, dummy.matrix);
      foliageInst.setMatrixAt(placedTrees, dummy.matrix);
      tint.setHSL(0.41 + (rand() - 0.5) * 0.04, 0.26, 0.19 + rand() * 0.07);
      foliageInst.setColorAt(placedTrees, tint);
      placedTrees++;
    }
    trunkInst.count = placedTrees;
    foliageInst.count = placedTrees;
    trunkInst.computeBoundingSphere();
    foliageInst.computeBoundingSphere();
    scene.add(trunkInst, foliageInst);

    // 2. Dynamic Flood Water Plane
    const waterGeo = new THREE.PlaneGeometry(54, 54, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);
    const waterBaseY = new Float32Array(waterGeo.attributes.position.count);
    for (let i = 0; i < waterBaseY.length; i++) {
      waterBaseY[i] = 0;
    }
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a5c73,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = 0.72;
    waterMesh.renderOrder = 2;
    scene.add(waterMesh);

    // 3. Villages & Camps Groups + Node coordinate lookup
    const nodePosMap = new Map<string, THREE.Vector3>();
    const villageBeacons = new Map<string, THREE.MeshStandardMaterial>();
    const villageGroups = new Map<string, THREE.Group>();
    const clickableMeshes: THREE.Object3D[] = [];

    for (const v of stateRef.current.villages) {
      const y = getTerrainHeightAt(v.x, v.z);
      nodePosMap.set(v.id, new THREE.Vector3(v.x, y, v.z));
      const { group, beaconMat, hitMesh } = buildVillageGroup(v);
      group.position.set(v.x, y, v.z);
      scene.add(group);
      villageBeacons.set(v.id, beaconMat);
      villageGroups.set(v.id, group);
      clickableMeshes.push(hitMesh);
    }

    for (const c of stateRef.current.camps) {
      const y = getTerrainHeightAt(c.x, c.z);
      nodePosMap.set(c.id, new THREE.Vector3(c.x, y, c.z));
      const { group, hitMesh } = buildCampGroup(c);
      group.position.set(c.x, y, c.z);
      scene.add(group);
      clickableMeshes.push(hitMesh);
    }

    // Selection halo ring grounded under selected node
    const selRingGeo = new THREE.RingGeometry(0.95, 1.18, 32);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0xf4ece1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.visible = false;
    scene.add(selRing);

    // 4. Static Road Network + 3 Interactive Concrete River Bridges
    const roadBaseGroup = new THREE.Group();
    scene.add(roadBaseGroup);

    const bridgeRecords: {
      edgeId: string;
      deckGroup: THREE.Group;
      hazardBar: THREE.Mesh;
      restY: number;
      hitMesh: THREE.Mesh;
    }[] = [];

    const baseRoadMat = new THREE.MeshStandardMaterial({
      color: 0x3b444f,
      roughness: 0.85,
      metalness: 0.12,
    });

    for (const edge of ROAD_EDGES) {
      const pA = nodePosMap.get(edge.from);
      const pB = nodePosMap.get(edge.to);
      if (!pA || !pB) continue;

      const pts: THREE.Vector3[] = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = THREE.MathUtils.lerp(pA.x, pB.x, t);
        const pz = THREE.MathUtils.lerp(pA.z, pB.z, t);
        let py = getTerrainHeightAt(px, pz) + 0.08;
        if (edge.isBridge) {
          // Arch bridge smoothly across river valley
          const midLift = Math.sin(t * Math.PI) * 0.72;
          py = Math.max(py, 1.38 + midLift * 0.35);
        }
        pts.push(new THREE.Vector3(px, py, pz));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.075, 6, false);
      const roadMesh = new THREE.Mesh(tubeGeo, baseRoadMat);
      roadBaseGroup.add(roadMesh);

      if (edge.isBridge) {
        // Place a multi-part concrete bridge deck across the river midpoint
        const midPt = curve.getPoint(0.5);
        const riverX = getRiverCenterX(midPt.z);
        const bridgePos = new THREE.Vector3(riverX, Math.max(midPt.y, 1.42), midPt.z);
        const angle = Math.atan2(pB.x - pA.x, pB.z - pA.z);

        const deckGroup = new THREE.Group();
        deckGroup.position.copy(bridgePos);
        deckGroup.rotation.y = angle;

        const concreteMat = new THREE.MeshStandardMaterial({
          color: 0x89929b,
          roughness: 0.72,
          metalness: 0.18,
        });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 2.55), concreteMat);
        deck.castShadow = true;
        deckGroup.add(deck);

        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 2.55), concreteMat);
        railL.position.set(-0.21, 0.12, 0);
        deckGroup.add(railL);
        const railR = railL.clone();
        railR.position.x = 0.21;
        deckGroup.add(railR);

        // Two bridge piers
        const pier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 8), concreteMat);
        pier1.position.set(0, -0.9, -0.85);
        deckGroup.add(pier1);
        const pier2 = pier1.clone();
        pier2.position.z = 0.85;
        deckGroup.add(pier2);

        // Hazard warning bar shown when bridge is severed
        const hazardMat = new THREE.MeshStandardMaterial({
          color: 0xd94e28,
          emissive: 0xd94e28,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        });
        const hazardBar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.18), hazardMat);
        hazardBar.position.set(0, 0.36, 0);
        hazardBar.visible = false;
        deckGroup.add(hazardBar);

        const hitMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.9, 2.7),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitMesh.userData = { nodeId: edge.id, nodeType: 'bridge' };
        hitMesh.layers.set(1);
        deckGroup.add(hitMesh);
        clickableMeshes.push(hitMesh);

        scene.add(deckGroup);
        bridgeRecords.push({
          edgeId: edge.id,
          deckGroup,
          hazardBar,
          restY: bridgePos.y,
          hitMesh,
        });
      }
    }

    // 5. Dynamic Logistics Layer (Route Splines, Trucks, Mesh Relay Arcs) — elevates cleanly in Exploded Layer mode
    const logisticsLayer = new THREE.Group();
    scene.add(logisticsLayer);

    const routeSplinesGroup = new THREE.Group();
    logisticsLayer.add(routeSplinesGroup);

    const meshRelayGroup = new THREE.Group();
    logisticsLayer.add(meshRelayGroup);

    const routeColors = [0xe05832, 0xd49a3a, 0x3b8ea5, 0x50b384];
    const truckEntries: {
      vehicleId: string;
      mesh: THREE.Group;
      curve: THREE.CatmullRomCurve3 | null;
      progress: number;
      speed: number;
    }[] = [];

    for (const d of stateRef.current.optimization.dispatches) {
      const mesh = buildTruckGroup(d.vehicle.amphibious);
      const startPos = nodePosMap.get(d.camp.id) || new THREE.Vector3();
      mesh.position.set(startPos.x, startPos.y + 0.1, startPos.z);
      logisticsLayer.add(mesh);
      truckEntries.push({
        vehicleId: d.vehicle.id,
        mesh,
        curve: null,
        progress: Math.random(),
        speed: 0.065 + (d.vehicle.speedKmh / 46) * 0.045,
      });
    }

    // Track mesh packets for traveling LoRa telemetry hops
    const meshPackets: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; phase: number }[] = [];

    let lastRoutingSignature = '';
    function rebuildDynamicLogistics() {
      const opt = stateRef.current.optimization;
      const sig = JSON.stringify({
        routes: opt.dispatches.map((d) => d.routeNodeIds),
        cuts: opt.activeCutEdgeIds,
        mesh: opt.meshRelayPaths.map((m) => m.hops),
        netDown: stateRef.current.networkDown,
      });
      if (sig === lastRoutingSignature) return;
      lastRoutingSignature = sig;

      // Clear old route meshes
      while (routeSplinesGroup.children.length > 0) {
        const child = routeSplinesGroup.children.pop() as THREE.Mesh;
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }

      // Rebuild active vehicle route splines
      opt.dispatches.forEach((d, idx) => {
        const entry = truckEntries.find((t) => t.vehicleId === d.vehicle.id);
        if (d.routeNodeIds.length < 2) {
          if (entry) entry.curve = null;
          return;
        }
        const rawPts: THREE.Vector3[] = [];
        for (let i = 0; i < d.routeNodeIds.length; i++) {
          const p = nodePosMap.get(d.routeNodeIds[i]);
          if (!p) continue;
          if (i > 0) {
            const prev = nodePosMap.get(d.routeNodeIds[i - 1]);
            if (prev) {
              // Insert midpoint terrain samples so route hugs hills cleanly
              for (let s = 1; s <= 4; s++) {
                const frac = s / 5;
                const mx = THREE.MathUtils.lerp(prev.x, p.x, frac);
                const mz = THREE.MathUtils.lerp(prev.z, p.z, frac);
                const my = Math.max(getTerrainHeightAt(mx, mz) + 0.22, 1.56);
                rawPts.push(new THREE.Vector3(mx, my, mz));
              }
            }
          }
          rawPts.push(new THREE.Vector3(p.x, p.y + 0.22, p.z));
        }
        if (rawPts.length < 2) return;
        const curve = new THREE.CatmullRomCurve3(rawPts);
        if (entry) entry.curve = curve;

        const col = routeColors[idx % routeColors.length];
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.55,
          roughness: 0.35,
        });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.095, 8, false), mat);
        routeSplinesGroup.add(tube);
      });

      // Clear old mesh relay arcs
      while (meshRelayGroup.children.length > 0) {
        const child = meshRelayGroup.children.pop() as THREE.Object3D;
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      }
      meshPackets.length = 0;

      if (stateRef.current.networkDown) {
        const arcMat = new THREE.MeshBasicMaterial({
          color: 0xd49a3a,
          transparent: true,
          opacity: 0.72,
        });
        const pktMat = new THREE.MeshBasicMaterial({ color: 0xfff0c2 });
        const pktGeo = new THREE.SphereGeometry(0.11, 8, 8);

        for (const relay of opt.meshRelayPaths) {
          for (let i = 0; i < relay.hops.length - 1; i++) {
            const a = nodePosMap.get(relay.hops[i]);
            const b = nodePosMap.get(relay.hops[i + 1]);
            if (!a || !b) continue;
            const mid = new THREE.Vector3(
              (a.x + b.x) / 2,
              Math.max(a.y, b.y) + 2.4 + a.distanceTo(b) * 0.14,
              (a.z + b.z) / 2
            );
            const curve = new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(a.x, a.y + 1.05, a.z),
              mid,
              new THREE.Vector3(b.x, b.y + 1.15, b.z)
            );
            const arcTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.03, 5, false), arcMat);
            meshRelayGroup.add(arcTube);

            const pkt = new THREE.Mesh(pktGeo, pktMat);
            meshRelayGroup.add(pkt);
            meshPackets.push({ mesh: pkt, curve, phase: Math.random() });
          }
        }
      }
    }

    // 6. Dynamic Rain Particle Field (scales opacity & speed with rainfallMm)
    const rainCount = 420;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 34;
      rainPositions[i * 3 + 1] = 2 + Math.random() * 14;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xa9cfe0,
      size: 0.11,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    scene.add(rainPoints);

    // Raycasting on dedicated layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      // Ignore orbit drags
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const { nodeId, nodeType } = hits[0].object.userData;
        if (nodeType === 'bridge') {
          onToggleCutBridge(nodeId);
        } else if (nodeId) {
          stateRef.current.onSelectNode(nodeId);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp layout adaptability
    const resizeObserver = new ResizeObserver(() => {
      if (!mountEl) return;
      const w = mountEl.clientWidth || 800;
      const h = mountEl.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mountEl);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation & software-WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let currentExplodeLift = 0;
    let currentWaterY = 0.72;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(0.08, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      const st = stateRef.current;
      rebuildDynamicLogistics();

      // 1. Update water elevation smoothly from riverLevelM (1.35m..6.25m -> Y 0.65..2.02)
      const targetWaterY = 0.56 + ((st.optimization.forecast.riverLevelM - 1.2) / 5.2) * 1.48;
      currentWaterY = THREE.MathUtils.damp(currentWaterY, targetWaterY, 3.2, dt);
      waterMesh.position.y = currentWaterY;

      // Subtle animated water wave surface
      const wPos = waterGeo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const wx = wPos.getX(i);
        const wz = wPos.getZ(i);
        const wave = Math.sin(wx * 0.45 + elapsed * 1.6) * 0.035 + Math.cos(wz * 0.52 - elapsed * 1.3) * 0.03;
        wPos.setY(i, wave);
      }
      wPos.needsUpdate = true;

      // 2. Update village beacons by priority tier & verification flag
      for (const scored of st.optimization.scoredVillages) {
        const bMat = villageBeacons.get(scored.village.id);
        if (!bMat) continue;
        if (scored.needsVerification) {
          bMat.color.setHex(0xd49a3a);
          bMat.emissive.setHex(0xd49a3a);
        } else if (scored.priorityScore >= 76 || scored.isFlooded) {
          bMat.color.setHex(0xe04f2e);
          bMat.emissive.setHex(0xe04f2e);
        } else if (scored.priorityScore >= 58) {
          bMat.color.setHex(0xd49a3a);
          bMat.emissive.setHex(0xd49a3a);
        } else {
          bMat.color.setHex(0x3c9d6e);
          bMat.emissive.setHex(0x3c9d6e);
        }
      }

      // 3. Update bridge fracture tilt when cut
      const cutSet = new Set(st.optimization.activeCutEdgeIds);
      for (const br of bridgeRecords) {
        const isCut = cutSet.has(br.edgeId);
        const targetTilt = isCut ? 0.34 : 0;
        const targetDrop = isCut ? br.restY - 0.38 : br.restY;
        br.deckGroup.rotation.x = THREE.MathUtils.damp(br.deckGroup.rotation.x, targetTilt, 4.5, dt);
        br.deckGroup.position.y = THREE.MathUtils.damp(br.deckGroup.position.y, targetDrop, 4.5, dt);
        br.hazardBar.visible = isCut;
      }

      // 4. Smoothly lift exploded logistics layer
      const targetLift = st.exploded ? 2.6 : 0;
      currentExplodeLift = THREE.MathUtils.damp(currentExplodeLift, targetLift, 4.2, dt);
      logisticsLayer.position.y = currentExplodeLift;

      // 5. Animate 4 supply trucks along their live assigned routes
      for (const entry of truckEntries) {
        if (!entry.curve) {
          entry.mesh.visible = false;
          continue;
        }
        entry.mesh.visible = true;
        entry.progress = (entry.progress + dt * entry.speed) % 1;
        entry.curve.getPointAt(entry.progress, _vA);
        entry.curve.getPointAt((entry.progress + 0.015) % 1, _vB);
        entry.mesh.position.copy(_vA);
        _dir.subVectors(_vB, _vA).normalize();
        if (_dir.lengthSq() > 0.0001) {
          _mat4.lookAt(_vB, _vA, _up);
          _quat.setFromRotationMatrix(_mat4);
          entry.mesh.quaternion.slerp(_quat, 0.25);
        }
      }

      // 6. Animate mesh relay signal packets
      for (const pkt of meshPackets) {
        pkt.phase = (pkt.phase + dt * 0.45) % 1;
        pkt.curve.getPoint(pkt.phase, pkt.mesh.position);
      }

      // 7. Rain particles scaling with rainfallMm
      const rainIntensity = Math.max(0, (st.rainfallMm - 20) / 260);
      rainPoints.visible = rainIntensity > 0.04;
      if (rainPoints.visible) {
        rainMat.opacity = Math.min(0.68, 0.1 + rainIntensity * 0.58);
        const rPos = rainGeo.attributes.position as THREE.BufferAttribute;
        const fallSpeed = 7.5 + rainIntensity * 11;
        for (let i = 0; i < rainCount; i++) {
          let ry = rPos.getY(i) - dt * fallSpeed;
          if (ry < 0.5) ry = 14 + Math.random() * 4;
          rPos.setY(i, ry);
        }
        rPos.needsUpdate = true;
      }

      // 8. Selection halo ring
      if (st.selectedNodeId && nodePosMap.has(st.selectedNodeId)) {
        const p = nodePosMap.get(st.selectedNodeId)!;
        selRing.visible = true;
        selRing.position.set(p.x, p.y + 0.16, p.z);
        selRing.rotation.z = elapsed * 0.4;
      } else {
        selRing.visible = false;
      }

      // 9. Camera choreography (smooth exponential damping)
      if (st.cameraPreset === 'follow' && truckEntries[0]?.curve) {
        const truckPos = truckEntries[0].mesh.position;
        _vCamTarget.set(truckPos.x + 5.2, truckPos.y + 4.8 + currentExplodeLift, truckPos.z + 5.8);
        _vLookTarget.set(truckPos.x, truckPos.y + currentExplodeLift, truckPos.z);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _vCamTarget.x, 3.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _vCamTarget.y, 3.2, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _vCamTarget.z, 3.2, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _vLookTarget.x, 4.0, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _vLookTarget.y, 4.0, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _vLookTarget.z, 4.0, dt);
      } else if (camTransitionRef.current.active) {
        const focusId = camTransitionRef.current.focusId;
        if (focusId && nodePosMap.has(focusId)) {
          const fp = nodePosMap.get(focusId)!;
          _vCamTarget.set(fp.x + 6.4, fp.y + 5.4, fp.z + 7.2);
          _vLookTarget.set(fp.x, fp.y + 0.4, fp.z);
        } else if (st.cameraPreset === 'valley') {
          _vCamTarget.set(2.5, 7.2, 16.5);
          _vLookTarget.set(-0.5, 1.4, -1.0);
        } else if (st.cameraPreset === 'topographic') {
          _vCamTarget.set(0.2, 26.5, 5.5);
          _vLookTarget.set(0, 1.0, 0);
        } else {
          _vCamTarget.set(17.5, 14.5, 20.5);
          _vLookTarget.set(0, 1.2, 0.5);
        }
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _vCamTarget.x, 3.6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _vCamTarget.y, 3.6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _vCamTarget.z, 3.6, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _vLookTarget.x, 3.6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _vLookTarget.y, 3.6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _vLookTarget.z, 3.6, dt);
        if (camera.position.distanceTo(_vCamTarget) < 0.15) {
          camTransitionRef.current.active = false;
        }
      } else if (compactHero && !isSoftwareGl) {
        // Gentle architectural orbit drift on landing hero
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.45;
      } else {
        controls.autoRotate = false;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      envTex.dispose();
      topoTex.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      renderer.dispose();
    };
  }, [compactHero]);

  const selectedScored = selectedNodeId
    ? optimization.scoredVillages.find((s) => s.village.id === selectedNodeId)
    : null;
  const selectedCamp = selectedNodeId ? camps.find((c) => c.id === selectedNodeId) : null;
  const bridgeB2Cut = optimization.activeCutEdgeIds.includes('E-B2');

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#0c1117] overflow-hidden select-none">
      {/* Isolated WebGL mount container */}
      <div ref={containerRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c1117] p-8 text-center">
          <p className="font-display text-lg text-[#ECEAE4]">3D Watershed Viewport Unavailable</p>
          <p className="mt-2 max-w-md text-sm text-[#A1A8B0]">
            WebGL hardware or software rendering could not initialize. Switch to the 2D Leaflet map inside the Control
            Room for full interactive routing.
          </p>
        </div>
      )}

      {/* Compact Hero Caption Strip (only when embedded in Overview hero) */}
      {compactHero && !webglError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
          <div className="pointer-events-auto bg-[#0f141b]/95 border border-white/10 rounded-lg px-3.5 py-2.5">
            <div className="text-xs text-[#A1A8B0]">
              Simulated Kosi-Mechi Basin · 12 Villages · 3 Camps · 4 Vehicles
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs font-mono-tabular text-[#ECEAE4]">
              <span>Rain {rainfallMm} mm</span>
              <span className="text-[#6E7782]">/</span>
              <span>Surge {optimization.forecast.riverLevelM} m</span>
              <span className="text-[#6E7782]">/</span>
              <span>Fairness {optimization.fairnessScore}/100</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 bg-[#0f141b]/95 border border-white/10 rounded-lg p-1">
            {(['basin', 'valley', 'topographic'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onSelectNode(null);
                  setCameraPreset(preset);
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 capitalize ${
                  cameraPreset === preset
                    ? 'bg-[#ECEAE4] text-[#0C1014] font-medium'
                    : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-Viewport Minimal Top-Left Spec Caption + Unified Collapsible Bottom Dock */}
      {!compactHero && !webglError && (
        <>
          <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between">
            <div className="pointer-events-auto bg-[#0f141b]/95 border border-white/10 rounded-lg px-4 py-2.5">
              <div className="text-sm font-display font-semibold text-[#ECEAE4]">
                Kosi-Mechi Flood District 3D Basin
              </div>
              <div className="mt-0.5 text-xs text-[#A1A8B0] font-mono-tabular">
                Simulated Data · Demand {optimization.forecast.demandMultiplier}x · River{' '}
                {optimization.forecast.riverLevelM}m · Fairness {optimization.fairnessScore}/100
              </div>
            </div>

            {(selectedScored || selectedCamp) && (
              <div className="pointer-events-auto max-w-sm bg-[#0f141b]/95 border border-white/15 rounded-lg px-4 py-3">
                {selectedScored ? (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display text-sm font-semibold text-[#ECEAE4]">
                        {selectedScored.village.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectNode(null)}
                        className="text-xs text-[#A1A8B0] hover:text-[#ECEAE4]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-1 text-xs font-mono-tabular text-[#A1A8B0]">
                      Priority {selectedScored.priorityScore}/100 · Pop {selectedScored.village.population} · Conf{' '}
                      {Math.round(selectedScored.village.visionConfidence * 100)}%
                    </div>
                    <p className="mt-1.5 text-xs text-[#D3D6DB] leading-relaxed">{selectedScored.reasonText}</p>
                  </>
                ) : selectedCamp ? (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display text-sm font-semibold text-[#ECEAE4]">{selectedCamp.name}</span>
                      <button
                        type="button"
                        onClick={() => onSelectNode(null)}
                        className="text-xs text-[#A1A8B0] hover:text-[#ECEAE4]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-1 text-xs font-mono-tabular text-[#A1A8B0]">
                      Elevation {selectedCamp.elevationM}m · Water {selectedCamp.stock.waterLiters.toLocaleString()} L ·
                      Food {selectedCamp.stock.foodKits} kits
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Collapsible Bottom Control Dock (Zero Side-Panel Occlusion, No backdrop-filter over WebGL) */}
          <div
            className="absolute bottom-5 left-1/2 z-20 w-[min(940px,94vw)] transition-transform duration-300 ease-out"
            style={{
              transform: dockCollapsed
                ? 'translateX(-50%) translateY(calc(100% - 34px))'
                : 'translateX(-50%) translateY(0)',
            }}
          >
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDockCollapsed((c) => !c)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#ECEAE4] bg-[#131922] border border-b-0 border-white/12 rounded-t-lg hover:bg-[#1b2430] transition-colors whitespace-nowrap"
              >
                {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
              </button>
            </div>

            <div className="bg-[#11171f]/95 border border-white/12 rounded-xl px-4 py-3.5 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Rainfall Forecast Regression Slider */}
                <div className="flex items-center gap-3 min-w-[230px] flex-1">
                  <Waves className="w-4 h-4 text-[#3B8EA5] shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#A1A8B0]">24h Rainfall Forecast</span>
                      <span className="font-mono-tabular text-[#ECEAE4] font-medium">
                        {rainfallMm} mm ({optimization.forecast.demandMultiplier}x)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={280}
                      step={5}
                      value={rainfallMm}
                      onChange={(e) => onRainfallChange(Number(e.target.value))}
                      aria-label="24-hour rainfall forecast in millimeters"
                      className="meridian-slider w-full"
                    />
                  </div>
                </div>

                <div className="h-7 w-px bg-white/10 hidden md:block" />

                {/* Interactive Disaster Triggers */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onToggleCutBridge('E-B2')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      bridgeB2Cut
                        ? 'bg-[#D94E28] border-[#D94E28] text-white'
                        : 'bg-[#19212c] border-white/10 text-[#D3D6DB] hover:border-white/25'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>{bridgeB2Cut ? 'Restore Bridge B2' : 'Cut Bridge B2'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleNetworkDown}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      networkDown
                        ? 'bg-[#D49A3A] border-[#D49A3A] text-[#0C1014]'
                        : 'bg-[#19212c] border-white/10 text-[#D3D6DB] hover:border-white/25'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{networkDown ? 'Mesh Relay Active' : 'Network Down'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExploded((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      exploded
                        ? 'bg-[#ECEAE4] border-[#ECEAE4] text-[#0C1014]'
                        : 'bg-[#19212c] border-white/10 text-[#D3D6DB] hover:border-white/25'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{exploded ? 'Collapse Layers' : 'Explode Layers'}</span>
                  </button>
                </div>

                <div className="h-7 w-px bg-white/10 hidden lg:block" />

                {/* Camera Presets */}
                <div className="flex items-center gap-1 bg-[#18202a] p-1 rounded-lg border border-white/8">
                  {(
                    [
                      { id: 'basin', label: 'Basin' },
                      { id: 'valley', label: 'Valley' },
                      { id: 'follow', label: 'Follow Truck' },
                      { id: 'topographic', label: 'Top' },
                    ] as { id: CameraPreset; label: string }[]
                  ).map((cam) => (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => {
                        onSelectNode(null);
                        setCameraPreset(cam.id);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        cameraPreset === cam.id
                          ? 'bg-[#ECEAE4] text-[#0C1014] font-medium'
                          : 'text-[#A1A8B0] hover:text-[#ECEAE4]'
                      }`}
                    >
                      {cam.id === 'follow' && <Truck className="w-3 h-3" />}
                      <span>{cam.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Reset Camera"
                    onClick={() => {
                      onSelectNode(null);
                      setCameraPreset('basin');
                      camTransitionRef.current = { active: true, preset: 'basin', focusId: null };
                    }}
                    className="p-1.5 text-[#A1A8B0] hover:text-[#ECEAE4] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
