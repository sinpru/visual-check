'use client';

import React, { useState } from 'react';
import { Columns2, Square, Layers, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const imgUrl = (p: string) =>
  p ? `/api/image?path=${encodeURIComponent(p)}` : '';

// ─── Image Pane ──────────────────────────────────────────────────────────────

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
}

function ImagePane({
  label,
  badge,
  badgeClass,
  dotClass,
  src,
  overlaySrc,
  showOverlay,
  overlayOpacity = 80,
  width,
  height,
  fullWidth,
  panelHeight,
}: ImagePaneProps) {
  return (
    <div className={cn('flex flex-col gap-3', fullWidth ? 'w-full' : 'flex-1 min-w-0')}>
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} />
          <span className="text-sm font-black text-slate-800 tracking-tight">{label}</span>
          <span
            className={cn(
              'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
              badgeClass,
            )}
          >
            {badge}
          </span>
        </div>
        {width && height && (
          <span className="text-[10px] font-mono text-slate-400 tabular-nums bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
            {width} × {height}
          </span>
        )}
      </div>

      {/* ── Image container — fixed height, no scroll, image contained ── */}
      <div
        className="relative rounded-2xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden"
        style={{ height: panelHeight }}
      >
        {/* Checkerboard transparency indicator */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none z-0"
          style={{
            backgroundImage:
              'repeating-conic-gradient(#94a3b8 0% 25%, transparent 0% 50%)',
            backgroundSize: '20px 20px',
          }}
        />

        {src ? (
          <>
            {/* Base image — object-contain so it never overflows the panel */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              className="absolute inset-0 w-full h-full object-contain z-10"
              draggable={false}
            />

            {/* Diff overlay — same contain sizing so it aligns perfectly */}
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
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">
              No image
            </p>
          </div>
        )}
      </div>
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
}) => {
  const [mode, setMode]               = useState<ViewMode>('both');
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(75);

  const hasDiff = !!diffPath;

  // ─── Image source resolution ───────────────────────────────────────────────
  //
  // Per AGENTS Issue 3: the data layer has the paths inverted — baselinePath
  // currently holds the web screenshot and currentPath holds the Figma export.
  // We swap here so the display is correct:
  //   LEFT  "Baseline / Expected" → Figma frame  (currentPath in data)
  //   RIGHT "Current  / Actual"   → Web snapshot (baselinePath in data)
  //
  const figmaSrc = imgUrl(currentPath);   // Figma export (baseline visually)
  const webSrc   = imgUrl(baselinePath);  // Web screenshot (actual visually)
  const diffSrc  = hasDiff ? imgUrl(diffPath!) : '';

  // Panel height: slightly taller in single-pane modes for better detail
  const panelHeight = mode === 'both' ? '62vh' : '74vh';

  return (
    <div className="flex flex-col gap-5">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* View mode tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-0.5">
          <ViewButton
            active={mode === 'both'}
            onClick={() => setMode('both')}
            icon={<Columns2 className="h-3.5 w-3.5" />}
            label="Both"
          />
          <ViewButton
            active={mode === 'baseline'}
            onClick={() => setMode('baseline')}
            icon={<Square className="h-3.5 w-3.5" />}
            label="Baseline"
          />
          <ViewButton
            active={mode === 'current'}
            onClick={() => setMode('current')}
            icon={<Square className="h-3.5 w-3.5" />}
            label="Current"
          />
        </div>

        {/* Overlay controls — only relevant when Current panel is visible */}
        {hasDiff && mode !== 'baseline' && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
            <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-black text-slate-500 shrink-0">Diff overlay</span>

            {/* Opacity slider — only when overlay is active */}
            {showOverlay && (
              <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                <SlidersHorizontal className="h-3 w-3 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
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

            {/* ON / OFF pill */}
            <div className="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded-xl">
              <ToggleButton active={showOverlay} onClick={() => setShowOverlay(true)}>
                ON
              </ToggleButton>
              <ToggleButton active={!showOverlay} onClick={() => setShowOverlay(false)}>
                OFF
              </ToggleButton>
            </div>
          </div>
        )}
      </div>

      {/* ── Image panels ── */}
      <div
        className={cn(
          'flex gap-5',
          mode === 'both' ? 'flex-row items-stretch' : 'flex-col',
        )}
      >
        {/* LEFT / FULL — Figma Baseline (EXPECTED) */}
        {(mode === 'both' || mode === 'baseline') && (
          <ImagePane
            label="Baseline"
            badge="Expected"
            badgeClass="bg-blue-50 text-blue-600 border-blue-100"
            dotClass="bg-blue-400"
            src={figmaSrc}
            width={currentWidth}
            height={currentHeight}
            fullWidth={mode === 'baseline'}
            panelHeight={panelHeight}
          />
        )}

        {/* RIGHT / FULL — Web Current (ACTUAL) with diff overlay on top */}
        {(mode === 'both' || mode === 'current') && (
          <ImagePane
            label="Current"
            badge="Actual"
            badgeClass="bg-amber-50 text-amber-600 border-amber-100"
            dotClass="bg-amber-400"
            src={webSrc}
            overlaySrc={diffSrc || undefined}
            showOverlay={showOverlay}
            overlayOpacity={overlayOpacity}
            width={baselineWidth}
            height={baselineHeight}
            fullWidth={mode === 'current'}
            panelHeight={panelHeight}
          />
        )}
      </div>

      {/* ── Viewport mismatch warning ── */}
      {baselineWidth && currentWidth && baselineWidth !== currentWidth && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="h-3 w-3 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800">Viewport size mismatch</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Baseline is {currentWidth}×{currentHeight}px · Current is {baselineWidth}×{baselineHeight}px.{' '}
              Pixel diff results may be inaccurate — normalize viewports in{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">playwright.config.ts</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
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
      {icon}
      {label}
    </button>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-[10px] text-[11px] font-black transition-all',
        active
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-400 hover:text-slate-600',
      )}
    >
      {children}
    </button>
  );
}

export default DiffViewer;