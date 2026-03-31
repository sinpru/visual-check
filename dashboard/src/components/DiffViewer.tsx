'use client';

import React, { useState } from 'react';

interface DiffViewerProps {
  testName: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  testName,
  baselinePath,
  currentPath,
  diffPath,
}) => {
  const [overlayMode, setOverlayMode] = useState(false);
  const [opacity, setOpacity] = useState(50);

  // Helper to build URLs using our internal /api/image proxy
  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">
          Visual Comparison
        </h2>
        <div className="flex items-center space-x-4 bg-white p-2 rounded-lg border border-gray-200">
          <label className="flex items-center cursor-pointer">
            <span className="mr-3 text-sm font-medium text-gray-700">
              Overlay Mode
            </span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={overlayMode}
                onChange={() => setOverlayMode(!overlayMode)}
              />
              <div
                className={`block w-10 h-6 rounded-full transition-colors ${overlayMode ? 'bg-blue-600' : 'bg-gray-300'}`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${overlayMode ? 'translate-x-4' : ''}`}
              ></div>
            </div>
          </label>

          {overlayMode && (
            <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-500">Opacity:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(parseInt(e.target.value))}
                className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono w-8">{opacity}%</span>
            </div>
          )}
        </div>
      </div>

      {!overlayMode ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 text-center">
            <span className="text-sm font-bold uppercase text-gray-500">
              Baseline
            </span>
            <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 aspect-square flex items-center justify-center">
              <img
                src={imageUrl(baselinePath)}
                alt="Baseline"
                className="max-w-full h-auto object-contain"
              />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <span className="text-sm font-bold uppercase text-gray-500">
              Current
            </span>
            <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 aspect-square flex items-center justify-center">
              <img
                src={imageUrl(currentPath)}
                alt="Current"
                className="max-w-full h-auto object-contain"
              />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <span className="text-sm font-bold uppercase text-gray-500">
              Difference
            </span>
            <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 aspect-square flex items-center justify-center">
              {diffPath ? (
                <img
                  src={imageUrl(diffPath)}
                  alt="Diff"
                  className="max-w-full h-auto object-contain"
                />
              ) : (
                <div className="text-gray-400 text-sm">
                  No diff available (Test passed)
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative max-w-4xl mx-auto border border-gray-300 rounded-xl overflow-hidden bg-white">
          <div className="relative aspect-square">
            <img
              src={imageUrl(baselinePath)}
              alt="Baseline (Underlay)"
              className="absolute inset-0 w-full h-full object-contain"
            />
            <img
              src={imageUrl(currentPath)}
              alt="Current (Overlay)"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ opacity: opacity / 100 }}
            />
          </div>
          <div className="p-4 bg-gray-50 text-xs text-gray-500 text-center">
            Overlaying <strong>Current</strong> over <strong>Baseline</strong>{' '}
            at {opacity}% opacity.
          </div>
        </div>
      )}
    </div>
  );
};

export default DiffViewer;
