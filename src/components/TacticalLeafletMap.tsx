import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  OptimizationResult,
  ROAD_EDGES,
  ReliefCamp,
  Village,
} from '../engine/disasterEngine';

interface TacticalLeafletMapProps {
  villages: Village[];
  camps: ReliefCamp[];
  optimization: OptimizationResult;
  networkDown: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleCutBridge: (edgeId: string) => void;
}

const ROUTE_COLORS = ['#E05832', '#D49A3A', '#3B8EA5', '#50B384'];

/**
 * Offline-safe procedural topographic Leaflet GridLayer (zero external tile dependencies or 404s)
 */
class TopographicCanvasLayer extends L.GridLayer {
  createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    const ctx = tile.getContext('2d');
    if (!ctx) return tile;

    // Deep mineral cartographic background
    ctx.fillStyle = '#0e141a';
    ctx.fillRect(0, 0, size.x, size.y);

    // Subtle topographic contour rings computed deterministically per tile coordinate
    ctx.strokeStyle = 'rgba(130, 160, 180, 0.08)';
    ctx.lineWidth = 1;
    const seedX = coords.x * 1.3;
    const seedY = coords.y * 1.3;
    for (let ring = 0; ring < 5; ring++) {
      ctx.beginPath();
      for (let x = 0; x <= size.x; x += 16) {
        const y =
          size.y * 0.2 * ring +
          Math.sin((x / size.x) * Math.PI * 2 + seedX + ring * 0.7) * 18 +
          Math.cos(seedY + ring) * 14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Crisp survey graticule ticks
    ctx.strokeStyle = 'rgba(236, 234, 228, 0.045)';
    ctx.strokeRect(0, 0, size.x, size.y);

    ctx.fillStyle = 'rgba(161, 168, 176, 0.25)';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(`${coords.z}/${coords.x}/${coords.y}`, 8, 16);

    return tile;
  }
}

export const TacticalLeafletMap: React.FC<TacticalLeafletMapProps> = ({
  villages,
  camps,
  optimization,
  networkDown,
  selectedNodeId,
  onSelectNode,
  onToggleCutBridge,
}) => {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dynamicLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center: [26.512, 87.302],
      zoom: 12,
      minZoom: 11,
      maxZoom: 14,
      attributionControl: false,
    });

    const topoLayer = new TopographicCanvasLayer({ tileSize: 256 });
    topoLayer.addTo(map);

    const dynLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    dynamicLayerRef.current = dynLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      dynamicLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = dynamicLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // River channel polygon band reflecting live surge width
    const surgeScale = 0.004 + (optimization.forecast.riverLevelM - 1.2) * 0.0022;
    const riverPoints: L.LatLngExpression[] = [];
    for (let i = 0; i <= 14; i++) {
      const lat = 26.6 - i * 0.013;
      const lng = 87.295 + Math.sin(i * 0.55) * 0.014;
      riverPoints.push([lat, lng - surgeScale]);
    }
    for (let i = 14; i >= 0; i--) {
      const lat = 26.6 - i * 0.013;
      const lng = 87.295 + Math.sin(i * 0.55) * 0.014;
      riverPoints.push([lat, lng + surgeScale]);
    }
    L.polygon(riverPoints, {
      color: '#3B8EA5',
      weight: 1,
      fillColor: '#1E5E76',
      fillOpacity: 0.42,
      interactive: false,
    }).addTo(layer);

    const coordMap = new Map<string, [number, number]>();
    camps.forEach((c) => coordMap.set(c.id, [c.lat, c.lng]));
    villages.forEach((v) => coordMap.set(v.id, [v.lat, v.lng]));

    const cutSet = new Set(optimization.activeCutEdgeIds);

    // Base road network & interactive cuttable bridges
    for (const edge of ROAD_EDGES) {
      const a = coordMap.get(edge.from);
      const b = coordMap.get(edge.to);
      if (!a || !b) continue;
      const isCut = cutSet.has(edge.id);
      L.polyline([a, b], {
        color: isCut ? '#D94E28' : '#3E4854',
        weight: isCut ? 3 : 2,
        dashArray: isCut ? '6 6' : undefined,
        opacity: isCut ? 0.9 : 0.65,
      }).addTo(layer);

      if (edge.isBridge) {
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const bridgeMarker = L.circleMarker(mid, {
          radius: 7,
          color: isCut ? '#D94E28' : '#A1A8B0',
          fillColor: isCut ? '#D94E28' : '#19212C',
          fillOpacity: 1,
          weight: 2,
        }).addTo(layer);
        bridgeMarker.bindTooltip(
          `${edge.bridgeName || edge.id} · ${isCut ? 'SEVERED (click to restore)' : 'Passable (click to cut)'}`,
          { direction: 'top' }
        );
        bridgeMarker.on('click', () => onToggleCutBridge(edge.id));
      }
    }

    // Active Vehicle Dispatch Routes
    optimization.dispatches.forEach((d, idx) => {
      if (d.routeNodeIds.length < 2) return;
      const latlngs = d.routeNodeIds
        .map((id) => coordMap.get(id))
        .filter((pt): pt is [number, number] => Boolean(pt));
      if (latlngs.length < 2) return;

      L.polyline(latlngs, {
        color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        weight: 3.5,
        opacity: 0.92,
      })
        .bindTooltip(`${d.vehicle.callsign} (${d.vehicle.type}) · ${d.totalDistanceKm} km · ${d.stops.length} stops`)
        .addTo(layer);
    });

    // Simulated Mesh Relay Hops when Network is Down
    if (networkDown) {
      for (const relay of optimization.meshRelayPaths) {
        const pts = relay.hops
          .map((id) => coordMap.get(id))
          .filter((pt): pt is [number, number] => Boolean(pt));
        if (pts.length < 2) continue;
        L.polyline(pts, {
          color: '#D49A3A',
          weight: 2,
          dashArray: '4 8',
          opacity: 0.85,
        }).addTo(layer);
      }
    }

    // Relief Camps (square architectural markers)
    for (const camp of camps) {
      const isSelected = selectedNodeId === camp.id;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#3B8EA5;border:2px solid ${
          isSelected ? '#FFFFFF' : '#0C1014'
        };border-radius:3px;box-shadow:0 0 0 2px rgba(59,142,165,0.35);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const m = L.marker([camp.lat, camp.lng], { icon }).addTo(layer);
      m.bindTooltip(`${camp.name} (${camp.id}) · Water ${camp.stock.waterLiters.toLocaleString()} L`);
      m.on('click', () => onSelectNode(camp.id));
    }

    // 12 Villages colored by Priority Tier & Verification flag
    for (const scored of optimization.scoredVillages) {
      const v = scored.village;
      const isSelected = selectedNodeId === v.id;
      const fillColor = scored.needsVerification
        ? '#D49A3A'
        : scored.priorityScore >= 76 || scored.isFlooded
          ? '#D94E28'
          : scored.priorityScore >= 58
            ? '#D49A3A'
            : '#3C9D6E';

      const marker = L.circleMarker([v.lat, v.lng], {
        radius: isSelected ? 10 : 7.5,
        color: isSelected ? '#FFFFFF' : '#0C1014',
        weight: isSelected ? 2.5 : 1.5,
        fillColor,
        fillOpacity: 0.95,
      }).addTo(layer);

      marker.bindTooltip(
        `<div style="font-size:12px;line-height:1.4"><strong>${v.name}</strong> (${v.id})<br/>Priority ${scored.priorityScore}/100 · Conf ${Math.round(
          v.visionConfidence * 100
        )}%</div>`,
        { direction: 'top' }
      );
      marker.on('click', () => onSelectNode(v.id));
    }
  }, [villages, camps, optimization, networkDown, selectedNodeId, onSelectNode, onToggleCutBridge]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-lg overflow-hidden border border-white/10">
      <div ref={mapElRef} className="w-full h-full z-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] bg-[#10151c]/95 border border-white/10 rounded-md px-3 py-1.5 text-[11px] font-mono-tabular text-[#A1A8B0]">
        Leaflet Offline Topographic Grid · Click bridges to sever / restore · Click nodes to inspect
      </div>
    </div>
  );
};
