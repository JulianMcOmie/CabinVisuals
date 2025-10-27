'use client';

import React, { useState, useCallback } from 'react';
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
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragCancelEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import debounce from 'lodash/debounce';

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

  // Get store actions
  const {
    availableEffects,
    addEffectToTrack,
    removeEffectFromTrack,
    updateEffectPropertyOnTrack,
    reorderEffectsOnTrack
  } = useStore();

  // State for adding new effects
  const [selectedEffectToAdd, setSelectedEffectToAdd] = useState<string>('');
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);

  // State to track collapsed state of effects
  const [collapsedEffects, setCollapsedEffects] = useState<Record<string, boolean>>({});

  // State to track the currently dragged item
  const [activeId, setActiveId] = useState<string | null>(null);

  // Combine all available effects into a flat list for dropdown
  const allEffectDefinitions = Object.values(availableEffects || {}).flat();

  // Toggle effect collapsed state
  const toggleEffectCollapsed = (effectId: string) => {
    setCollapsedEffects(prev => ({
      ...prev,
      [effectId]: !prev[effectId]
    }));
  };

  // Original handler - remains the same
  const handleEffectPropertyChangeInternal = (effectIndex: number, propertyName: string, newValue: any) => {
    updateEffectPropertyOnTrack(track.id, effectIndex, propertyName, newValue);
  };

  // Debounced version of the handler for the store update
  // We use useCallback to ensure the debounced function is memoized
  const debouncedUpdateEffectProperty = useCallback(
    debounce((effectIndex: number, propertyName: string, newValue: any) => {
      handleEffectPropertyChangeInternal(effectIndex, propertyName, newValue);
    }, 300), // 300ms delay
    [track.id, updateEffectPropertyOnTrack] // Dependencies for useCallback
  );

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
            onChange={(value) => debouncedUpdateEffectProperty(effectIndex, property.name, value)}
          />
        );
      case 'numberInput':
        return (
          <NumberInputPropertyControl
            key={key}
            property={property as Property<number>}
            onChange={(value) => handleEffectPropertyChangeInternal(effectIndex, property.name, value)}
          />
        );
      case 'dropdown':
        return (
          <DropdownPropertyControl
            key={key}
            property={property as Property<unknown>}
            onChange={(value) => handleEffectPropertyChangeInternal(effectIndex, property.name, value)}
          />
        );
      case 'color':
        return (
          <ColorPropertyControl
            key={key}
            property={property as Property<string>}
            onChange={(value) => handleEffectPropertyChangeInternal(effectIndex, property.name, value)}
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

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

   // --- Handlers for Drag Events ---
   function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  // Handler for when a drag operation ends (reordering)
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = track.effects.findIndex(effect => effect.id === active.id);
      const newIndex = track.effects.findIndex(effect => effect.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderEffectsOnTrack(track.id, oldIndex, newIndex);
      }
    }
    setActiveId(null); // Clear active ID on drag end
  }

  function handleDragCancel(event: DragCancelEvent) {
      setActiveId(null); // Clear active ID on drag cancel
  }
  // --- End Drag Event Handlers ---


  // --- Effect Item Content Component (Presentational) ---
  interface EffectItemContentProps {
    effect: Effect;
    index: number; // Keep index for property controls
    trackId: string; // Keep trackId for remove action
    collapsed: boolean;
    isDragging?: boolean; // Optional: for potential styling differences in overlay
    onToggleCollapse: (id: string) => void;
    onRemove: (trackId: string, index: number) => void;
    getEffectName: (effect: Effect) => string;
    renderPropertyControl: (index: number, property: Property<any>) => React.ReactNode;
    COLORS: typeof COLORS;
    dragHandleProps?: any; // To pass down drag handle listeners/attributes
  }

  function EffectItemContent({
    effect,
    index,
    trackId,
    collapsed,
    isDragging,
    onToggleCollapse,
    onRemove,
    getEffectName,
    renderPropertyControl,
    COLORS,
    dragHandleProps
  }: EffectItemContentProps) {
    return (
      <div
        className="rounded-md p-3 relative"
        style={{
          backgroundColor: COLORS.surface,
          borderColor: COLORS.border,
          borderWidth: 1,
        }}
      >
        {/* Drag Handle */}
        <div
          className="absolute left-0 inset-y-0 flex items-center px-1 cursor-grab opacity-30 hover:opacity-100 touch-none"
          {...dragHandleProps} // Apply drag handle props here
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>

        {/* Effect Content */}
        <div
          className="flex justify-between items-center pl-6 cursor-pointer"
          onClick={() => onToggleCollapse(effect.id)}
        >
          <div className="flex items-center">
            <h4 className="font-medium">{getEffectName(effect)}</h4>
          </div>
          <div className="flex items-center">
            <button
              className="h-6 w-6 p-0 mr-1 rounded-md hover:bg-[#444] hover:text-white transition-all flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation(); // Prevent toggling collapse when removing
                onRemove(trackId, index);
              }}
            >
              <X className="h-4 w-4" />
            </button>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
          </div>
        </div>

        {/* Effect Properties (Conditionally Rendered) */}
        {!collapsed && (
          <div className="mt-2 space-y-2 pl-6">
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
    );
  }
  // --- End Effect Item Content Component ---


  // --- Sortable Effect Item Component ---
  interface SortableEffectItemProps {
    id: string;
    effect: Effect;
    index: number;
    trackId: string;
    collapsed: boolean;
    onToggleCollapse: (id: string) => void;
    onRemove: (trackId: string, index: number) => void;
    getEffectName: (effect: Effect) => string;
    renderPropertyControl: (index: number, property: Property<any>) => React.ReactNode;
    COLORS: typeof COLORS;
  }

  function SortableEffectItem({
    id,
    effect,
    index,
    trackId,
    collapsed,
    onToggleCollapse,
    onRemove,
    getEffectName,
    renderPropertyControl,
    COLORS
  }: SortableEffectItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging, // Use this for visual feedback during drag
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0 : 1, // Hide original item when dragging
      // Remove zIndex, backgroundColor, borderColor, borderWidth as they are now in EffectItemContent
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        // No className needed here anymore, moved to EffectItemContent
      >
        <EffectItemContent
          effect={effect}
          index={index}
          trackId={trackId}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onRemove={onRemove}
          getEffectName={getEffectName}
          renderPropertyControl={renderPropertyControl}
          COLORS={COLORS}
          dragHandleProps={{ ...attributes, ...listeners }} // Pass down drag handle props
        />
      </div>
    );
  }
  // --- End Sortable Effect Item Component ---

  // Find the active effect instance for the DragOverlay
  const activeEffect = activeId ? track.effects.find(effect => effect.id === activeId) : null;
  const activeEffectIndex = activeId ? track.effects.findIndex(effect => effect.id === activeId) : -1;

  return (
    <div
      className="flex-1 p-4 overflow-auto text-white"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Effects Chain for Track "{track.name}"</h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart} // Added
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel} // Added
      >
        <SortableContext
          items={track.effects.map(effect => effect.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Added mb-4 for padding */}
          <div className="space-y-3 mb-4">
            {track.effects && track.effects.length > 0 ? (
              track.effects.map((effect, index) => (
                <SortableEffectItem
                  key={effect.id}
                  id={effect.id}
                  effect={effect}
                  index={index}
                  trackId={track.id}
                  collapsed={!!collapsedEffects[effect.id]}
                  onToggleCollapse={toggleEffectCollapsed}
                  onRemove={removeEffectFromTrack}
                  getEffectName={getEffectName}
                  renderPropertyControl={renderPropertyControl}
                  COLORS={COLORS}
                />
              ))
            ) : (
              <div className="text-center text-gray-400 py-4">
                No effects added to this track. Drag effects here to add.
              </div>
            )}
          </div>
        </SortableContext>

        {/* Drag Overlay for preview */}
        <DragOverlay>
          {activeEffect && activeEffectIndex !== -1 ? (
            <EffectItemContent
              effect={activeEffect}
              index={activeEffectIndex} // Pass the correct index for the active item
              trackId={track.id}
              collapsed={!!collapsedEffects[activeEffect.id]} // Use collapsed state for the active item
              isDragging={true} // Indicate it's being dragged (for potential styling)
              onToggleCollapse={() => {}} // No-op for overlay
              onRemove={() => {}} // No-op for overlay
              getEffectName={getEffectName}
              renderPropertyControl={renderPropertyControl}
              COLORS={COLORS}
              // No dragHandleProps needed for the overlay item itself
            />
          ) : null}
        </DragOverlay>
        {/* End Drag Overlay */}
      </DndContext>

      <div>
        <button
          className="w-full py-2 border border-dashed rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          style={{ borderColor: "#555" }}
          onClick={() => setShowEffectsMenu(!showEffectsMenu)}
        >
          + Add Effect
        </button>

        {showEffectsMenu && (
          <div
            className="mt-1 rounded-md shadow-lg border"
            style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
          >
            {/* ... Effect selection menu ... */}
            <div className="p-2">
              <div className="text-sm font-medium mb-2 text-gray-300">Effect Type</div>
              <div className="space-y-1">
                {/* Group by category */}
                {allEffectDefinitions.length > 0 ? (
                  Object.entries(
                    allEffectDefinitions.reduce((acc, def) => {
                      // Default to 'Other' if category doesn't exist
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