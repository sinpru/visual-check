'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Columns2, Square, Layers, SlidersHorizontal,
  AlertTriangle, X, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiffRegion } from '@visual-check/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'both' | 'baseline' | 'current';

interface DiffViewerProps {
  testName: string;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  baselineWidth?: number;
  baselineHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  diffRegions?: DiffRegion[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const imgUrl = (p: string) =>
  p ? `/api/image?path=${encodeURIComponent(p)}` : '';

// ─── SVG Region Overlay ───────────────────────────────────────────────────────

/**
 * Renders region bounding boxes and numbered pins using an SVG whose viewBox
 * matches the image's native pixel dimensions. Because SVG with
 * preserveAspectRatio="xMidYMid meet" behaves identically to CSS object-fit:contain,
 * the pins align with the underlying <img> with no JavaScript measurement.
 */
function RegionOverlay({
  regions,
  activeIndex,
  onRegionClick,
  imageWidth,
  imageHeight,
  showOnRight,
}: {
  regions: DiffRegion[];
  activeIndex: number | null;
  onRegionClick: (index: number) => void;
  imageWidth: number;
  imageHeight: number;
  showOnRight: boolean; // only RIGHT panel shows filled boxes; LEFT shows outlines only
}) {
  if (!regions.length || !imageWidth || !imageHeight) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full z-30"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {regions.map((region) => {
        const isActive = activeIndex === region.index;
        const pinR  = Math.max(14, Math.round(imageWidth * 0.008)); // scale pin to image
        const pinCx = region.x + region.width / 2;
        const pinCy = Math.max(region.y + pinR, region.y);          // keep pin inside image
        const stroke = isActive ? '#ef4444' : '#f97316';
        const fill   = isActive ? '#ef4444' : '#f97316';
        const fontSize = Math.max(12, Math.round(imageWidth * 0.007));

        return (
          <g
            key={region.index}
            onClick={() => onRegionClick(region.index)}
            style={{ cursor: 'pointer' }}
          >
            {/* Bounding box */}
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill={showOnRight && isActive ? 'rgba(239,68,68,0.08)' : 'none'}
              stroke={stroke}
              strokeWidth={Math.max(2, imageWidth * 0.001)}
              strokeDasharray={isActive ? 'none' : `${imageWidth * 0.004} ${imageWidth * 0.002}`}
              opacity={isActive ? 1 : 0.65}
            />

            {/* Pin circle */}
            <circle
              cx={pinCx}
              cy={pinCy + pinR}
              r={pinR}
              fill={fill}
              opacity={isActive ? 1 : 0.85}
            />

            {/* Pin label */}
            <text
              x={pinCx}
              y={pinCy + pinR}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {region.index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Image Pane ───────────────────────────────────────────────────────────────

interface ImagePaneProps {
  label: string;
  badge: string;
  badgeClass: string;
  dotClass: string;
  src: string;
  overlaySrc?: string;
  showOverlay?: boolean;
  overlayOpacity?: number;
  width?: number;
  height?: number;
  fullWidth?: boolean;
  panelHeight: string;
  regions?: DiffRegion[];
  activeRegionIndex: number | null;
  onRegionClick: (index: number) => void;
  isRightPanel?: boolean;
}

function ImagePane({
  label, badge, badgeClass, dotClass,
  src, overlaySrc, showOverlay, overlayOpacity = 80,
  width, height, fullWidth, panelHeight,
  regions = [], activeRegionIndex, onRegionClick, isRightPanel = false,
}: ImagePaneProps) {
  return (
    <div className={cn('flex flex-col gap-3', fullWidth ? 'w-full' : 'flex-1 min-w-0')}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} />
          <span className="text-sm font-black text-slate-800 tracking-tight">{label}</span>
          <span className={cn(
            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
            badgeClass,
          )}>
            {badge}
          </span>
        </div>
        {width && height && (
          <span className="text-[10px] font-mono text-slate-400 tabular-nums bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
            {width} × {height}
          </span>
        )}
      </div>

      {/* ── Image container — fixed height, object-contain, no scroll ── */}
      <div
        className="relative rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden"
        style={{ height: panelHeight }}
      >
        {/* Checkerboard */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none z-0"
          style={{
            backgroundImage: 'repeating-conic-gradient(#94a3b8 0% 25%, transparent 0% 50%)',
            backgroundSize: '20px 20px',
          }}
        />

        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              className="absolute inset-0 w-full h-full object-contain z-10"
              draggable={false}
            />

            {overlaySrc && showOverlay && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlaySrc}
                alt="diff overlay"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                style={{ opacity: overlayOpacity / 100 }}
                draggable={false}
              />
            )}

            {/* SVG pin overlay — same viewBox as image, same contain behaviour */}
            {regions.length > 0 && width && height && (
              <RegionOverlay
                regions={regions}
                activeIndex={activeRegionIndex}
                onRegionClick={onRegionClick}
                imageWidth={width}
                imageHeight={height}
                showOnRight={isRightPanel}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">No image</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inspection Panel (moveable) ──────────────────────────────────────────────

function InspectionPanel({
  region,
  onClose,
}: {
  region: DiffRegion;
  onClose: () => void;
}) {
  const [pos, setPos]         = useState({ x: 24, y: 24 });
  const dragging              = useRef(false);
  const dragOffset            = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current   = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  return (
    <div
      className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-72 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-100 cursor-grab active:cursor-grabbing rounded-t-2xl bg-slate-50/80"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
          <span className="text-sm font-black text-slate-900">Region {region.index + 1}</span>
          <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded-lg">
            #{region.index + 1}
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-3.5">

        {/* Position / size */}
        <Row label="Position">
          <code className="text-xs text-slate-700">
            ({region.x}, {region.y}) · {region.width}×{region.height}px
          </code>
        </Row>

        {/* Diff stats */}
        <Row label="Changed">
          <span className="text-xs font-mono text-slate-700">
            {region.diffPixels.toLocaleString()} px
            <span className="text-slate-400 ml-1">
              ({region.diffPercent.toFixed(2)}% of image)
            </span>
          </span>
        </Row>

        {/* DOM element */}
        {region.domLabel && (
          <Row label="Web element">
            <code className="text-[11px] text-violet-700 bg-violet-50 px-2 py-1 rounded-lg break-all leading-relaxed">
              {region.domLabel}
            </code>
          </Row>
        )}

        {/* Figma node — future */}
        {region.figmaLabel && (
          <Row label="Design node">
            <code className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg break-all">
              {region.figmaLabel}
            </code>
          </Row>
        )}

        {/* Shift — future */}
        {(region.deltaX != null || region.deltaY != null) && (
          <Row label="Shift">
            <span className="text-xs font-mono text-slate-700">
              {region.deltaX != null ? `Δx ${region.deltaX > 0 ? '+' : ''}${region.deltaX}px` : ''}
              {region.deltaX != null && region.deltaY != null ? '  ' : ''}
              {region.deltaY != null ? `Δy ${region.deltaY > 0 ? '+' : ''}${region.deltaY}px` : ''}
            </span>
          </Row>
        )}

        {/* Fallback when no annotations yet */}
        {!region.domLabel && !region.figmaLabel && region.deltaX == null && (
          <p className="text-[11px] text-slate-400 italic">
            No element info — DOM lookup may not have run for this region.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DiffViewer: React.FC<DiffViewerProps> = ({
  testName,
  baselinePath,
  currentPath,
  diffPath,
  baselineWidth,
  baselineHeight,
  currentWidth,
  currentHeight,
  diffRegions = [],
}) => {
  const [mode,            setMode]           = useState<ViewMode>('both');
  const [showOverlay,     setShowOverlay]     = useState(true);
  const [overlayOpacity,  setOverlayOpacity]  = useState(75);
  const [activeRegionIndex, setActiveRegionIndex] = useState<number | null>(null);

  const hasDiff   = !!diffPath;
  const hasRegions = diffRegions.length > 0;

  // Path swap — see AGENTS.md for the full explanation.
  // currentPath in data = Figma PNG → LEFT "Baseline / Expected"
  // baselinePath in data = web PNG   → RIGHT "Current / Actual" + diff overlay
  const figmaSrc = imgUrl(currentPath);
  const webSrc   = imgUrl(baselinePath);
  const diffSrc  = hasDiff ? imgUrl(diffPath!) : '';

  const panelHeight = mode === 'both' ? '62vh' : '74vh';

  function handleRegionClick(index: number) {
    setActiveRegionIndex((prev) => (prev === index ? null : index));
  }

  const activeRegion = activeRegionIndex !== null
    ? diffRegions.find((r) => r.index === activeRegionIndex) ?? null
    : null;

  return (
    // relative so the inspection panel positions within this container
    <div className="flex flex-col gap-5 relative">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* View mode */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-0.5">
          <ViewButton active={mode === 'both'}     onClick={() => setMode('both')}     icon={<Columns2 className="h-3.5 w-3.5" />} label="Broth" />
          <ViewButton active={mode === 'baseline'} onClick={() => setMode('baseline')} icon={<Square  className="h-3.5 w-3.5" />} label="Baseline" />
          <ViewButton active={mode === 'current'}  onClick={() => setMode('current')}  icon={<Square  className="h-3.5 w-3.5" />} label="Current" />
        </div>

        {/* Overlay controls */}
        {hasDiff && mode !== 'baseline' && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
            <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-black text-slate-500 shrink-0">Diff overlay</span>

            {showOverlay && (
              <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                <SlidersHorizontal className="h-3 w-3 text-slate-400 shrink-0" />
                <input
                  type="range" min={10} max={100} step={5}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-24 h-1.5 appearance-none cursor-pointer accent-slate-700"
                  aria-label="Overlay opacity"
                />
                <span className="text-[10px] font-mono text-slate-400 w-8 text-right tabular-nums shrink-0">
                  {overlayOpacity}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded-xl">
              <ToggleButton active={showOverlay}  onClick={() => setShowOverlay(true)}>ON</ToggleButton>
              <ToggleButton active={!showOverlay} onClick={() => setShowOverlay(false)}>OFF</ToggleButton>
            </div>
          </div>
        )}
      </div>

      {/* ── Image panels ── */}
      <div className={cn('flex gap-5', mode === 'both' ? 'flex-row items-stretch' : 'flex-col')}>

        {/* LEFT — Figma baseline (EXPECTED) */}
        {(mode === 'both' || mode === 'baseline') && (
          <ImagePane
            label="Baseline" badge="Expected"
            badgeClass="bg-blue-50 text-blue-600 border-blue-100" dotClass="bg-blue-400"
            src={figmaSrc}
            width={currentWidth} height={currentHeight}
            fullWidth={mode === 'baseline'}
            panelHeight={panelHeight}
            regions={diffRegions}
            activeRegionIndex={activeRegionIndex}
            onRegionClick={handleRegionClick}
            isRightPanel={false}
          />
        )}

        {/* RIGHT — Web current (ACTUAL) + diff overlay */}
        {(mode === 'both' || mode === 'current') && (
          <ImagePane
            label="Current" badge="Actual"
            badgeClass="bg-amber-50 text-amber-600 border-amber-100" dotClass="bg-amber-400"
            src={webSrc}
            overlaySrc={diffSrc || undefined}
            showOverlay={showOverlay}
            overlayOpacity={overlayOpacity}
            width={baselineWidth} height={baselineHeight}
            fullWidth={mode === 'current'}
            panelHeight={panelHeight}
            regions={diffRegions}
            activeRegionIndex={activeRegionIndex}
            onRegionClick={handleRegionClick}
            isRightPanel={true}
          />
        )}
      </div>

      {/* ── Region list ── */}
      {hasRegions && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1 shrink-0">
            <MapPin className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {diffRegions.length} region{diffRegions.length !== 1 ? 's' : ''}
            </span>
          </div>
          {diffRegions.map((region) => {
            const isActive = activeRegionIndex === region.index;
            return (
              <button
                key={region.index}
                onClick={() => handleRegionClick(region.index)}
                title={region.domLabel ?? `Region ${region.index + 1} — ${region.diffPixels.toLocaleString()} changed px`}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all border',
                  isActive
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:border-orange-300',
                )}
              >
                <span className={cn(
                  'h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-black',
                  isActive ? 'bg-white/25' : 'bg-orange-200',
                )}>
                  {region.index + 1}
                </span>
                <span className="font-mono">{region.diffPixels.toLocaleString()}px</span>
                {region.domLabel && (
                  <span className={cn(
                    'text-[9px] max-w-24 truncate hidden sm:block',
                    isActive ? 'text-white/80' : 'text-orange-500',
                  )}>
                    {region.domLabel.split(' — ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Viewport mismatch warning ── */}
      {baselineWidth && currentWidth && baselineWidth !== currentWidth && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="h-3 w-3 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800">Viewport size mismatch</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Baseline is {currentWidth}×{currentHeight}px · Current is {baselineWidth}×{baselineHeight}px.
              Pixel diff results may be inaccurate — normalize viewports in{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">playwright.config.ts</code>.
            </p>
          </div>
        </div>
      )}

      {/* ── Moveable inspection panel ── */}
      {activeRegion && (
        <InspectionPanel
          region={activeRegion}
          onClose={() => setActiveRegionIndex(null)}
        />
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViewButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all',
        active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-400 hover:text-slate-600',
      )}
    >
      {icon}{label}
    </button>
  );
}

function ToggleButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-[10px] text-[11px] font-black transition-all',
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
      )}
    >
      {children}
    </button>
  );
}

export default DiffViewer;