# Meridian Relief — Disaster Preparedness & Essential Supply Management

An interactive React + TypeScript + Three.js + Leaflet web application demonstrating pre-disaster preparedness, rainfall-triggered auto re-routing, YOLOv8 perception confidence gating, offline SMS/LoRa mesh queuing, and equitable last-mile vehicle routing across a simulated 12-village flood district.

## Quick Start in VS Code

1. Extract `meridian-relief-vscode.zip` to a folder on your machine.
2. Open the extracted `meridian-relief` folder in **Visual Studio Code** (`File -> Open Folder...`).
3. Open the integrated terminal (`Ctrl + ~` or `Cmd + ~`) and run:

```bash
npm install
npm run dev
```

4. Open `http://localhost:3000` in your browser.

## Available Scripts

- `npm run dev` — Start the Vite development server on port 3000
- `npm run build` — Build the production bundle into `dist/`
- `npm run preview` — Preview the production build locally
- `npm run lint` — Run TypeScript type checking (`tsc --noEmit`)

## Project Structure

```text
meridian-relief/
├── .vscode/                  # Recommended VS Code extensions & workspace settings
├── index.html                # HTML entry point & Google Fonts
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite + Tailwind v4 configuration
└── src/
    ├── App.tsx               # Main shell, 3-zone header, 3D transitions & shared state
    ├── index.css             # Tailwind v4 styles, typography tokens & Leaflet dark theme
    ├── main.tsx              # React root entry
    ├── assets/images/        # Documentary field photography for YOLOv8 intake
    ├── engine/
    │   └── disasterEngine.ts # Seeded district model, rainfall regression, Dijkstra/VRP, fairness & SMS/mesh
    └── components/
        ├── BasinScene3D.tsx       # Three.js PBR 3D flood basin diorama & collapsible HUD dock
        ├── TacticalLeafletMap.tsx # Offline-safe procedural topographic 2D Leaflet map
        ├── TiltFrame3D.tsx        # Hardware-accelerated 3D spatial tilt card
        ├── OverviewView.tsx       # Landing showcase, 5 literature gaps & village preparedness checklists
        ├── ControlRoomView.tsx    # Forecast slider, fairness toggle, map/3D view & explainable dispatch queue
        ├── FieldIntakeView.tsx    # Supply request form, SMS/mesh preview & YOLOv8 bounding-box analyzer
        └── ArchitectureView.tsx   # Gap-to-feature matrix, live JSON/CSV schema export & honest limitations
```

## Honest Limitations

- **Simulated data**: Coordinates, village populations, inventories, and road graphs represent a seeded flood district model (`SIMULATED_KOSI_MECHI_V1`).
- **Regression vs. trained LSTM**: Rainfall demand multipliers and river levels are computed using a lightweight deterministic quadratic regression model.
- **Simulated SMS & Mesh**: Offline packet compression and multi-hop LoRa relay paths are simulated in software without physical GSM or LoRa transceivers.
