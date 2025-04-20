import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../../../lib/types';
import InstrumentView from './InstrumentView';
import './InstrumentsView.css';
import useStore from '../../../store/store';
import { SelectedWindowType } from '../../../store/uiSlice'; // Import type if needed

interface InstrumentsViewProps {
  tracks: Track[];
  effectiveTrackHeight: number;
}

function InstrumentsView({ tracks, effectiveTrackHeight }: InstrumentsViewProps) {
  // --- State for Track Reordering ---
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [initialY, setInitialY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [orderedTrackIds, setOrderedTrackIds] = useState<string[] | null>(null);

  // --- State for Mute/Solo Dragging ---
  const [muteSoloDragInfo, setMuteSoloDragInfo] = useState<{
    action: 'mute' | 'solo';
    targetState: boolean;
  } | null>(null);

  const reorderTracks = useStore(state => state.reorderTracks);
  const selectTrack = useStore(state => state.selectTrack);
  const updateTrack = useStore(state => state.updateTrack); // Correctly get updateTrack from store
  const setSelectedWindow = useStore(state => state.setSelectedWindow); // Get action from uiSlice
  // Get state and actions for delete functionality
  const selectedWindow = useStore((state) => state.selectedWindow);
  const selectedTrackId = useStore((state) => state.selectedTrackId);
  const removeTrack = useStore((state) => state.removeTrack);

  const draggedTrack = tracks.find(t => t.id === draggingTrackId);

  // --- Handlers for Track Reordering ---
  const handleDragStart = useCallback((trackId: string, startY: number, offsetY: number) => {
    if (muteSoloDragInfo) return;
    selectTrack(trackId);
    setDraggingTrackId(trackId);
    setInitialY(startY);
    setCurrentY(startY);
    setDragOffsetY(offsetY);
  }, [selectTrack, muteSoloDragInfo]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingTrackId === null || initialY === null || !containerRef.current) return;
    if (muteSoloDragInfo) return;
    event.preventDefault();
    const newCurrentY = event.clientY;
    setCurrentY(newCurrentY);

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseYRelativeToContainer = newCurrentY - containerRect.top;
    const targetIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor((mouseYRelativeToContainer - dragOffsetY + effectiveTrackHeight / 2) / effectiveTrackHeight)));

    // Use current track order if no drag-reordering has happened yet, otherwise use the temporary order
    const currentTrackIds = orderedTrackIds ?? tracks.map(t => t.id);
    const draggedItemIndex = currentTrackIds.findIndex(id => id === draggingTrackId);

    if (draggedItemIndex === -1) return; // Should not happen

    const newOrder = [...currentTrackIds];
    const [removed] = newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setOrderedTrackIds(newOrder);

  }, [draggingTrackId, initialY, tracks, effectiveTrackHeight, dragOffsetY, muteSoloDragInfo, orderedTrackIds]);

  const handleMouseUp = useCallback(() => {
    // This handles the mouseup for track reordering
    if (draggingTrackId === null) return;

    if (orderedTrackIds) { // Check if reordering actually happened
      const droppedIndex = orderedTrackIds.findIndex(id => id === draggingTrackId);

      if (droppedIndex !== -1) {
        const targetTrackId = droppedIndex + 1 < orderedTrackIds.length
          ? orderedTrackIds[droppedIndex + 1]
          : null;
        reorderTracks(draggingTrackId, targetTrackId);
      } else {
        console.warn("Dragged track ID not found in final ordered list. Cannot reorder.");
      }
    }
    // Reset track reorder state regardless
    setDraggingTrackId(null);
    setInitialY(null);
    setCurrentY(null);
    setDragOffsetY(0);
    setOrderedTrackIds(null);
  }, [draggingTrackId, orderedTrackIds, reorderTracks]);

  // --- Handlers for Mute/Solo Dragging ---
  const handleMuteSoloDragStart = useCallback((_trackId: string, action: 'mute' | 'solo', targetState: boolean) => {
    if (draggingTrackId) return;
    setMuteSoloDragInfo({ action, targetState });
    const handleMouseUpGlobal = () => {
      setMuteSoloDragInfo(null);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
    window.addEventListener('mouseup', handleMouseUpGlobal);
  }, [draggingTrackId]);

  const handleTrackHoverDuringMuteSoloDrag = useCallback((hoveredTrackId: string) => {
    if (!muteSoloDragInfo) return;
    const track = tracks.find(t => t.id === hoveredTrackId);
    if (!track) return;
    const { action, targetState } = muteSoloDragInfo;
    const propertyToUpdate = action === 'mute' ? 'isMuted' : 'isSoloed';
    if (track[propertyToUpdate] !== targetState) {
      updateTrack(hoveredTrackId, { [propertyToUpdate]: targetState });
    }
  }, [muteSoloDragInfo, tracks, updateTrack]);

  // --- Handlers ---

  const handleContainerMouseDown = useCallback(() => {
    setSelectedWindow('instrumentsView');
  }, [setSelectedWindow]);

  // --- Effects ---
  useEffect(() => {
    if (draggingTrackId !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
      document.body.style.cursor = 'grabbing';
      document.body.classList.add('dragging-no-select');
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.classList.remove('dragging-no-select');
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.classList.remove('dragging-no-select');
    };
  }, [draggingTrackId, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return; // Don't delete if user is typing
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedWindow === 'instrumentsView' && selectedTrackId) {
          const trackToDelete = tracks.find(t => t.id === selectedTrackId);
          
          if (trackToDelete) {
            if (trackToDelete.midiBlocks && trackToDelete.midiBlocks.length > 0) {
              if (window.confirm(`Track "${trackToDelete.name}" contains MIDI blocks. Are you sure you want to delete it?`)) {
                removeTrack(selectedTrackId);
                console.log('Deleted track (with confirmation)', selectedTrackId);
                event.preventDefault();
              } else {
                console.log('Track deletion cancelled by user', selectedTrackId);
                event.preventDefault();
              }
            } else {
              removeTrack(selectedTrackId);
              console.log('Deleted track (no blocks)', selectedTrackId);
              event.preventDefault();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedWindow, selectedTrackId, removeTrack, tracks]);

  // --- Rendering Logic ---
  const currentMouseYRelativeToContainer = containerRef.current && currentY !== null
    ? currentY - containerRef.current.getBoundingClientRect().top
    : 0;

  const ghostTopPosition = currentMouseYRelativeToContainer - dragOffsetY;

  // Determine the tracks to display based on the current order state
  const displayTracks = orderedTrackIds
    ? orderedTrackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => t !== undefined)
    : tracks;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', height: '100%' }}
      onMouseDown={handleContainerMouseDown}
    >
      {displayTracks.map(track => {
        // Check if this track is the placeholder for track reordering
        const isReorderPlaceholder = track.id === draggingTrackId;

        if (isReorderPlaceholder) {
          return (
            <div
              key={`${track.id}-placeholder`}
              style={{
                height: `${effectiveTrackHeight}px`,
                borderBottom: '1px solid #333',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                boxSizing: 'border-box',
              }}
            />
          );
        } else {
          // Render the actual InstrumentView for non-placeholder tracks
          return (
            <div
              key={`${track.id}-instrument-container`}
              style={{
                height: `${effectiveTrackHeight}px`,
              }}
            >
              <InstrumentView
                track={track}
                onDragStart={handleDragStart}
                isDragging={false} // Regular view is never the ghost
                // Pass mute/solo drag props
                onMuteSoloDragStart={handleMuteSoloDragStart}
                isMuteSoloDragging={muteSoloDragInfo !== null}
                onTrackHoverDuringMuteSoloDrag={handleTrackHoverDuringMuteSoloDrag}
              />
            </div>
          );
        }
      })}

      {/* Ghost element for track reordering - Rendered separately */}
      {draggingTrackId && draggedTrack && currentY !== null && (
        <div
          style={{
            position: 'absolute',
            top: `${ghostTopPosition}px`,
            left: 0,
            right: 0,
            height: `${effectiveTrackHeight}px`,
            zIndex: 1000,
            pointerEvents: 'none',
            cursor: 'grabbing',
          }}
        >
          <InstrumentView
             track={draggedTrack}
             isDragging={true} // This is the ghost
             // Mute/Solo props for the ghost - disable interaction
             onMuteSoloDragStart={() => {}} // No-op
             isMuteSoloDragging={false}    // Never dragging mute/solo itself
             onTrackHoverDuringMuteSoloDrag={() => {}} // No-op
          />
        </div>
      )}
    </div>
  );
}

export default InstrumentsView; 