'use client';

import React, { useState } from 'react';
import { Track } from '../../lib/types';
import { ChevronDown, GripVertical, X } from 'lucide-react';

interface EffectsDetailViewProps {
  track: Track;
}

function EffectsDetailView({ track }: EffectsDetailViewProps) {
  // Colors constant - matches the one from page.tsx
  const COLORS = {
    accent: "#5a8ea3", // Subtle blue-gray
    highlight: "#c8a45b", // Muted gold/amber
    green: "#6a9955", // Muted green
    background: "#1e1e1e", // Dark background
    surface: "#252525", // Slightly lighter surface
    border: "#3a3a3a", // Border color
    activeBg: "#2d3540", // Active element background
  };

  // Mock effects chain data
  const [effectsChain, setEffectsChain] = useState([
    {
      id: 1,
      name: "Reverb",
      params: { roomSize: 75, damping: 40 },
      collapsed: false,
    },
    {
      id: 2,
      name: "Delay",
      params: { time: 50, feedback: 30 },
      collapsed: false,
    },
  ]);

  const toggleEffectCollapsed = (index: number) => {
    const newEffectsChain = [...effectsChain];
    newEffectsChain[index] = {
      ...newEffectsChain[index],
      collapsed: !newEffectsChain[index].collapsed,
    };
    setEffectsChain(newEffectsChain);
  };

  const removeEffect = (id: number) => {
    const newEffectsChain = effectsChain.filter((effect) => effect.id !== id);
    setEffectsChain(newEffectsChain);
  };

  return (
    <div className="flex-1 p-4 overflow-auto text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Effects Chain for Track {track.id}</h3>
      </div>

      <div className="space-y-3">
        {effectsChain.map((effect, index) => (
          <div
            key={effect.id}
            className="rounded-md p-3 relative group"
            style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1 }}
          >
            <div className="absolute left-0 inset-y-0 flex items-center px-1 cursor-grab opacity-30 group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            
            <div
              className="flex justify-between items-center pl-6 cursor-pointer"
              onClick={() => toggleEffectCollapsed(index)}
            >
              <div className="flex items-center">
                <h4 className="font-medium">{effect.name}</h4>
              </div>
              <div className="flex items-center">
                <button
                  className="h-6 w-6 p-0 mr-1 rounded-md hover:bg-[#444] hover:text-white transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEffect(effect.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${effect.collapsed ? "-rotate-90" : ""}`}
                />
              </div>
            </div>

            {!effect.collapsed && (
              <div className="mt-2 space-y-2 pl-6">
                {Object.entries(effect.params).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      <span>{value}%</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                      <div className="absolute inset-0 h-1 bg-[#3a3a3a] rounded-full top-1/2 -translate-y-1/2"></div>
                      <div
                        className="absolute h-1 rounded-full top-1/2 -translate-y-1/2"
                        style={{ width: `${value}%`, backgroundColor: COLORS.accent }}
                      ></div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border cursor-grab"
                        style={{
                          left: `calc(${value}% - 6px)`,
                          backgroundColor: COLORS.accent,
                          borderColor: "#ddd",
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="relative">
          <button
            className="w-full py-2 border border-dashed rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            style={{ borderColor: "#555" }}
          >
            + Add Effect
          </button>
        </div>
      </div>
    </div>
  );
}

export default EffectsDetailView; 