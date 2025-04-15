import { useState, useEffect, useCallback, RefObject } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import { UseBoundStore, StoreApi } from 'zustand'; // Assuming Zustand types

// Constants from TrackTimelineView - consider moving these to a shared location if used elsewhere
const PIXELS_PER_BEAT = 100;
const GRID_SNAP = 0.25;

interface UseTrackGesturesProps {
  tracks: Track[];
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  selectBlock: (blockId: string | null) => void;
  timelineAreaRef: RefObject<HTMLDivElement | null>;
}

export function useTrackGestures({
  tracks,
  updateMidiBlock,
  selectBlock,
  timelineAreaRef,
}: UseTrackGesturesProps) {
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragEndBeat, setDragEndBeat] = useState(0);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);

  // Helper to find track by ID (moved from component)
  const findTrackById = useCallback((trackId: string | null): Track | null => {
    if (!trackId) return null;
    return tracks.find(t => t.id === trackId) || null;
  }, [tracks]);

  // Handle mouse up and move for drag operations
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragOperation !== 'none') {
        setDragOperation('none');
        setDragBlockId(null);
        setDragTrackId(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragBlockId || !dragTrackId || !timelineAreaRef.current) return;

      const track = findTrackById(dragTrackId);
      const block = track?.midiBlocks.find(b => b.id === dragBlockId);
      if (!block || !track) {
        console.error("Could not find track or block during drag move.");
        handleMouseUp(); // Abort drag if track/block is gone
        return;
      }

      const timelineAreaRect = timelineAreaRef.current.getBoundingClientRect();
      if (!timelineAreaRect) return;

      const currentX = e.clientX;
      const deltaX = currentX - dragStartX;
      // Use Math.round for snapping
      const deltaBeat = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
      let updatedBlock = { ...block };
      let newStartBeat: number | undefined;
      let newEndBeat: number | undefined;
      let changed = false;

      if (dragOperation === 'start') {
        newStartBeat = Math.max(0, Math.min(block.endBeat - GRID_SNAP, dragStartBeat + deltaBeat));
        if (newStartBeat !== updatedBlock.startBeat) {
            updatedBlock.startBeat = newStartBeat;
            changed = true;
        }
      } else if (dragOperation === 'end') {
        newEndBeat = Math.max(block.startBeat + GRID_SNAP, dragEndBeat + deltaBeat);
         if (newEndBeat !== updatedBlock.endBeat) {
            updatedBlock.endBeat = newEndBeat;
            changed = true;
        }
      } else if (dragOperation === 'move') {
        const duration = block.endBeat - block.startBeat;
        newStartBeat = Math.max(0, dragStartBeat + deltaBeat);
        if (newStartBeat !== updatedBlock.startBeat) {
            updatedBlock.startBeat = newStartBeat;
            updatedBlock.endBeat = newStartBeat + duration;
            changed = true;
        }
      }

      // Only update if the block actually changed
      if (changed) {
           updateMidiBlock(track.id, updatedBlock);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
    // Dependencies now include props passed to the hook
  }, [dragOperation, dragStartX, dragBlockId, dragTrackId, dragStartBeat, dragEndBeat, updateMidiBlock, findTrackById, timelineAreaRef]);

  // Start resizing from the left edge
  const handleStartEdge = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('start');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId);
    setDragStartBeat(block.startBeat);
  }, [findTrackById]);

  // Start resizing from the right edge
  const handleEndEdge = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('end');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId);
    setDragEndBeat(block.endBeat);
  }, [findTrackById]);

  // Start moving the block
  const handleMoveBlock = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('move');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId);
    setDragStartBeat(block.startBeat);
    selectBlock(blockId); // Also select the block being moved
  }, [findTrackById, selectBlock]);

  return {
    handleStartEdge,
    handleEndEdge,
    handleMoveBlock,
    // No need to return drag state if not used by component
  };
}

// Define placeholder types if not already imported
// declare module '../../lib/types' {
//   interface Track {
//     id: string;
//     midiBlocks: MIDIBlock[];
//   }
//   interface MIDIBlock {
//     id: string;
//     startBeat: number;
//     endBeat: number;
//     notes: any[]; // Define more specifically if possible
//   }
// }

// declare module 'zustand' {
//   interface StoreApi<T> {}
//   interface UseBoundStore<S extends StoreApi<unknown>> {}
// } 