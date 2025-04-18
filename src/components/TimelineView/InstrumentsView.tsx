import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../../lib/types';
import InstrumentView from './InstrumentView';

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

  const draggedTrack = tracks.find(t => t.id === draggingTrackId);

  const handleDragStart = useCallback((trackId: string, startY: number, offsetY: number) => {
    setDraggingTrackId(trackId);
    setInitialY(startY);
    setCurrentY(startY);
    setDragOffsetY(offsetY);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingTrackId === null || initialY === null) return;
    event.preventDefault();
    setCurrentY(event.clientY);
  }, [draggingTrackId, initialY]);

  const handleMouseUp = useCallback(() => {
    if (draggingTrackId === null) return;
    setDraggingTrackId(null);
    setInitialY(null);
    setCurrentY(null);
    setDragOffsetY(0);
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

  const currentMouseYRelativeToContainer = containerRef.current && currentY !== null
    ? currentY - containerRef.current.getBoundingClientRect().top
    : 0;

  const ghostTopPosition = currentMouseYRelativeToContainer - dragOffsetY;

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%' }}>
      {tracks.map(track => {
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