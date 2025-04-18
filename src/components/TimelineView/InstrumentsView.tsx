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
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container

  // Get track data for ghost element
  const draggedTrack = tracks.find(t => t.id === draggingTrackId);

  const handleDragStart = useCallback((trackId: string, startY: number) => {
    setDraggingTrackId(trackId);
    setInitialY(startY);
    setCurrentY(startY);
    // Prevent default drag behavior which can interfere
    // It's better to handle this in the listeners if needed
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingTrackId === null || initialY === null) return;
    event.preventDefault(); // Prevent text selection while dragging
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
      document.addEventListener('mouseup', handleMouseUp, { once: true }); // Use once to auto-remove after mouse up
      document.body.style.cursor = 'grabbing'; // Change cursor globally
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      // No need to remove mouseup due to { once: true }
       document.body.style.cursor = ''; // Reset cursor
    }

    // Cleanup function
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp); // Still good practice to remove in cleanup
      document.body.style.cursor = ''; // Reset cursor on unmount/dependency change
    };
  }, [draggingTrackId, handleMouseMove, handleMouseUp]);

  // Calculate the offset for the ghost element relative to the container
  const ghostOffsetY = containerRef.current && currentY !== null && initialY !== null
    ? currentY - containerRef.current.getBoundingClientRect().top
    : 0;

  return (
    // Added a ref and relative positioning for the ghost
    <div ref={containerRef} style={{ position: 'relative', height: '100%' }}>
      {/* Map over tracks to render InstrumentView */}
      {tracks.map(track => (
        <div
          key={`${track.id}-instrument-container`} // Use a different key for the container div
          style={{
            height: `${effectiveTrackHeight}px`, // Use effective track height
             borderBottom: '1px solid #333',
             boxSizing: 'border-box',
          }}
        >
          <InstrumentView
            track={track}
            onDragStart={handleDragStart}
            isDragging={draggingTrackId === track.id}
          />
        </div>
      ))}

      {/* Ghost element for dragging */}
      {draggingTrackId && draggedTrack && currentY !== null && initialY !== null && (
        <div
          style={{
            position: 'absolute',
            top: `${ghostOffsetY - (effectiveTrackHeight / 2)}px`,
            left: 0,
            right: 0,
            height: `${effectiveTrackHeight}px`,
            backgroundColor: 'rgba(50, 50, 50, 0.8)',
            border: '1px dashed #888',
            zIndex: 1000, 
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            color: '#fff',
             boxSizing: 'border-box',
             cursor: 'grabbing',
          }}
        >
          {/* Display track name in ghost */}
          <span>{draggedTrack.name || 'Untitled Track'}</span>
        </div>
      )}
    </div>
  );
}

export default InstrumentsView; 