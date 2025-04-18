import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../../../lib/types';
import InstrumentView from './InstrumentView';
import './InstrumentsView.css';
import useStore from '../../../store/store';

interface InstrumentsViewProps {
  tracks: Track[];
  effectiveTrackHeight: number;
}

function InstrumentsView({ tracks, effectiveTrackHeight }: InstrumentsViewProps) {
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [initialY, setInitialY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [orderedTrackIds, setOrderedTrackIds] = useState<string[] | null>(null);

  const reorderTracks = useStore(state => state.reorderTracks);
  const selectTrack = useStore(state => state.selectTrack);

  const draggedTrack = tracks.find(t => t.id === draggingTrackId);

  const handleDragStart = useCallback((trackId: string, startY: number, offsetY: number) => {
    selectTrack(trackId);
    setDraggingTrackId(trackId);
    setInitialY(startY);
    setCurrentY(startY);
    setDragOffsetY(offsetY);
  }, [selectTrack]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingTrackId === null || initialY === null || !containerRef.current) return;
    event.preventDefault();
    const newCurrentY = event.clientY;
    setCurrentY(newCurrentY);

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseYRelativeToContainer = newCurrentY - containerRect.top;
    const targetIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor((mouseYRelativeToContainer - dragOffsetY + effectiveTrackHeight / 2) / effectiveTrackHeight)));

    const currentTrackIds = tracks.map(t => t.id);
    const draggedItemIndex = currentTrackIds.findIndex(id => id === draggingTrackId);

    if (draggedItemIndex === -1) return; // Should not happen

    const newOrder = [...currentTrackIds];
    const [removed] = newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setOrderedTrackIds(newOrder);

  }, [draggingTrackId, initialY, tracks, effectiveTrackHeight, dragOffsetY]);

  const handleMouseUp = useCallback(() => {
    if (draggingTrackId === null || !orderedTrackIds) {
      setDraggingTrackId(null);
      setInitialY(null);
      setCurrentY(null);
      setDragOffsetY(0);
      setOrderedTrackIds(null);
      return;
    }

    const finalOrderedIds = [...orderedTrackIds];
    const droppedIndex = finalOrderedIds.findIndex(id => id === draggingTrackId);

    if (droppedIndex !== -1) {
      const targetTrackId = droppedIndex + 1 < finalOrderedIds.length 
        ? finalOrderedIds[droppedIndex + 1] 
        : null;

      reorderTracks(draggingTrackId, targetTrackId);
    } else {
      console.warn("Dragged track ID not found in final ordered list. Cannot reorder.");
    }

    setDraggingTrackId(null);
    setInitialY(null);
    setCurrentY(null);
    setDragOffsetY(0);
    setOrderedTrackIds(null);
  }, [draggingTrackId, orderedTrackIds, reorderTracks]);

  useEffect(() => {
    if (draggingTrackId !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
      document.body.style.cursor = 'grabbing';
      document.body.classList.add('dragging-no-select');
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
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

  const currentMouseYRelativeToContainer = containerRef.current && currentY !== null
    ? currentY - containerRef.current.getBoundingClientRect().top
    : 0;

  const ghostTopPosition = currentMouseYRelativeToContainer - dragOffsetY;

  // Determine the tracks to display based on the current order state
  const displayTracks = orderedTrackIds
    ? orderedTrackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => t !== undefined)
    : tracks;

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%' }}>
      {displayTracks.map(track => {
        if (track.id === draggingTrackId) {
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
                isDragging={false}
              />
            </div>
          );
        }
      })}

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
             isDragging={true}
          />
        </div>
      )}
    </div>
  );
}

export default InstrumentsView; 