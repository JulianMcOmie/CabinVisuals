import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../../lib/types';
import InstrumentView from './InstrumentView';
import useStore from '../../store/store'; // Import useStore to get track name for ghost

interface InstrumentsViewProps {
  tracks: Track[];
  effectiveTrackHeight: number;
}

function InstrumentsView({ tracks, effectiveTrackHeight }: InstrumentsViewProps) {
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [initialY, setInitialY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draggedTrack = tracks.find(t => t.id === draggingTrackId);

  const handleDragStart = useCallback((trackId: string, startY: number) => {
    setDraggingTrackId(trackId);
    setInitialY(startY);
    setCurrentY(startY);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingTrackId === null || initialY === null) return;
    event.preventDefault();
    setCurrentY(event.clientY);
  }, [draggingTrackId, initialY]);

  const handleMouseUp = useCallback(() => {
    if (draggingTrackId === null) return;
    // Reset state - drop logic will go here later
    setDraggingTrackId(null);
    setInitialY(null);
    setCurrentY(null);
  }, [draggingTrackId]);

  useEffect(() => {
    if (draggingTrackId !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
      document.body.style.cursor = 'grabbing';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
       document.body.style.cursor = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [draggingTrackId, handleMouseMove, handleMouseUp]);

  const ghostOffsetY = containerRef.current && currentY !== null && initialY !== null
    ? currentY - containerRef.current.getBoundingClientRect().top
    : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%' }}>
      {/* Draw all instrument views */}
      {tracks.map(track => {
        if (track.id === draggingTrackId) {
          return (
            <div
              key={`${track.id}-placeholder`}
              style={{
                height: `${effectiveTrackHeight}px`,
                borderBottom: '1px solid #333',
                backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark placeholder background
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

      {/* Ghost element for dragging - Renders InstrumentView */}
      {draggingTrackId && draggedTrack && currentY !== null && initialY !== null && (
        <div
          style={{
            position: 'absolute',
            top: `${ghostOffsetY - (effectiveTrackHeight / 2)}px`,
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