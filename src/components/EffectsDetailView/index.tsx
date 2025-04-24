'use client';

import React, { useState } from 'react';
import { Track } from '../../lib/types';
import { ChevronDown, GripVertical, X } from 'lucide-react';
import useStore from '../../store/store';
import Effect from '../../lib/Effect';
import { Property } from '../../lib/properties/Property';
import SliderPropertyControl from '../properties/SliderPropertyControl';
import NumberInputPropertyControl from '../properties/NumberInputPropertyControl';
import DropdownPropertyControl from '../properties/DropdownPropertyControl';
import ColorPropertyControl from '../properties/ColorPropertyControl';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface EffectsDetailViewProps {
  track: Track;
}

function EffectsDetailView({ track }: EffectsDetailViewProps) {
  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get store actions and state needed for dnd-kit
  const {
    availableEffects,
    addEffectToTrack,
    removeEffectFromTrack,
    updateEffectPropertyOnTrack,
    // reorderEffectsOnTrack // Commented out
  } = useStore();

  // State for adding new effects
  const [selectedEffectToAdd, setSelectedEffectToAdd] = useState<string>('');
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);

  // State to track collapsed state of effects
  const [collapsedEffects, setCollapsedEffects] = useState<Record<string, boolean>>({});

  // Combine all available effects into a flat list for dropdown
  const allEffectDefinitions = Object.values(availableEffects || {}).flat();

  // Toggle effect collapsed state
  const toggleEffectCollapsed = (effectId: string) => {
    setCollapsedEffects(prev => ({
      ...prev,
      [effectId]: !prev[effectId]
    }));
  };

  // Handler for changing effect properties
  const handleEffectPropertyChange = (effectIndex: number, propertyName: string, newValue: any) => {
    const effectId = track.effects[effectIndex]?.id;
    if (!effectId) return; // Should not happen if index is valid
    updateEffectPropertyOnTrack(track.id, effectIndex, propertyName, newValue);
  };

  // Handler to add a new effect
  const handleAddEffect = (effectId: string) => {
    if (!effectId) return;

    const definition = allEffectDefinitions.find(def => def.id === effectId);
    if (definition) {
      const newEffectInstance = new definition.constructor(uuidv4());
      addEffectToTrack(track.id, newEffectInstance);
      setSelectedEffectToAdd('');
      setShowEffectsMenu(false);
    }
  };

  // Helper to get effect name from instance
  const getEffectName = (effect: Effect): string => {
    const definition = allEffectDefinitions.find(def => effect instanceof def.constructor);
    return definition ? definition.name : effect.constructor.name;
  };

  // Render the appropriate property control for a given effect property
  const renderPropertyControl = (effectIndex: number, property: Property<any>) => {
    const key = `${track.id}-effect-${effectIndex}-prop-${property.name}`;
    
    switch (property.uiType) {
      case 'slider':
        return (
          <SliderPropertyControl
            key={key}
            property={property as Property<number>}
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)}
          />
        );
      case 'numberInput':
        return (
          <NumberInputPropertyControl
            key={key}
            property={property as Property<number>}
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)}
          />
        );
      case 'dropdown':
        return (
          <DropdownPropertyControl
            key={key}
            property={property as Property<unknown>}
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)}
          />
        );
      case 'color':
        return (
          <ColorPropertyControl
            key={key}
            property={property as Property<string>}
            onChange={(value) => handleEffectPropertyChange(effectIndex, property.name, value)}
          />
        );
      default:
        return (
          <div key={key} className="relative h-6 flex items-center">
            <div className="text-xs text-gray-400">
              {property.name}: {property.value} ({property.uiType})
            </div>
          </div>
        );
    }
  };

  // Handle dropping an effect onto the view (Keep this for potential future use, doesn't involve dnd-kit directly)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!track) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'effect' && data.id) {
        handleAddEffect(data.id);
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  // Handle dragging over the view (Keep this for potential future use, doesn't involve dnd-kit directly)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (track) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  };

  // dnd-kit drag end handler - COMMENTED OUT
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = track.effects.findIndex(effect => effect.id === active.id);
      const newIndex = track.effects.findIndex(effect => effect.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        // reorderEffectsOnTrack(track.id, oldIndex, newIndex);
      }
    }
  };

  // Colors constant
  const COLORS = {
    accent: "#5a8ea3",
    highlight: "#c8a45b",
    green: "#6a9955",
    background: "#1e1e1e",
    surface: "#252525",
    border: "#3a3a3a",
    activeBg: "#2d3540",
  };

  // Component for each sortable effect item - COMMENTED OUT ENTIRELY
  // const SortableEffectItem = ({ effect, index }: { effect: Effect, index: number }) => { ... };

  return (
    <div
      className="flex-1 p-4 overflow-y-auto text-white"
      onDrop={handleDrop} // Keep native drop handler
      onDragOver={handleDragOver} // Keep native drag over handler
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Effects Chain for Track {track.id}</h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // onDragEnd={handleDragEnd} // Keep commented out for now
      >
        <SortableContext
          items={track.effects.map(e => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {track.effects && track.effects.length > 0 ? (
              track.effects.map((effect, index) => (
                // Replace SortableEffectItem with the simple div structure
                <div
                  key={effect.id}
                  className="rounded-md p-3 relative"
                  style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1 }}
                >
                  {/* No Drag Handle */}
                  <div
                    className="flex justify-between items-center pl-6 cursor-pointer"
                    onClick={() => toggleEffectCollapsed(effect.id)}
                  >
                    <div className="flex items-center">
                      <h4 className="font-medium">{getEffectName(effect)}</h4>
                    </div>
                    <div className="flex items-center">
                      <button
                        className="h-6 w-6 p-0 mr-1 rounded-md hover:bg-[#444] hover:text-white transition-all flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEffectFromTrack(track.id, index);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${collapsedEffects[effect.id] ? "-rotate-90" : ""}`}
                      />
                    </div>
                  </div>

                  {!collapsedEffects[effect.id] && (
                    <div 
                      className="mt-2 space-y-2 pl-6" 
                      // No stopPropagation needed here now
                    >
                      {Array.from(effect.properties.values()).length > 0 ? (
                        Array.from(effect.properties.values()).map(property =>
                          renderPropertyControl(index, property)
                        )
                      ) : (
                        <div className="text-xs text-gray-400">No adjustable parameters</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-4">
                No effects added to this track. Drag one from the list below or the sidebar.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Effect Button and Menu (remains the same) */}
      <div className="mt-4 relative"> {/* Added margin top */}
        <button
          className="w-full py-2 border border-dashed rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          style={{ borderColor: "#555" }}
          onClick={() => setShowEffectsMenu(!showEffectsMenu)}
        >
          + Add Effect
        </button>

        {showEffectsMenu && (
          <div
            className="absolute left-0 right-0 bottom-full mb-1 rounded-md shadow-lg z-20 border max-h-60 overflow-y-auto" // Positioned above, added max-height and scroll
            style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
          >
            <div className="p-2">
              <div className="text-sm font-medium mb-2 text-gray-300">Effect Type</div>
              <div className="space-y-1">
                {/* Group by category */}
                {allEffectDefinitions.length > 0 ? (
                  Object.entries(
                    allEffectDefinitions.reduce((acc, def) => {
                      const category = 'Other';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(def);
                      return acc;
                    }, {} as Record<string, typeof allEffectDefinitions>)
                  ).map(([category, effects]) => (
                    <div key={category} className="mb-2">
                      <div className="text-xs font-medium text-gray-400 mb-1">{category}</div>
                      <div className="pl-2 space-y-1">
                        {effects.map(effect => (
                          <div
                            key={effect.id}
                            className="text-sm py-1 px-2 hover:bg-[#3a3a3a] rounded cursor-pointer flex items-center"
                            onClick={() => handleAddEffect(effect.id)}
                          >
                            {effect.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400">No effects available</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EffectsDetailView; 