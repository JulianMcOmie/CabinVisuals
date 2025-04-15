import { useState, useEffect, useCallback, RefObject, useRef } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import { UseBoundStore, StoreApi } from 'zustand'; // Assuming Zustand types
import { MidiParser } from '../../lib/MidiParser'; // Import MidiParser
import TimeManager from '../../lib/TimeManager'; // Import TimeManager type if needed

// Constants from TrackTimelineView - consider moving these to a shared location if used elsewhere
const PIXELS_PER_BEAT = 100;
const GRID_SNAP = 0.25;
const TRACK_HEIGHT = 50; // Assuming constant TRACK_HEIGHT, move if needed

interface UseTrackGesturesProps {
  tracks: Track[];
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  addMidiBlock: (trackId: string, block: MIDIBlock) => void;
  removeMidiBlock: (trackId: string, blockId: string) => void;
  selectBlock: (blockId: string | null) => void;
  selectedBlockId: string | null;
  timelineAreaRef: RefObject<HTMLDivElement | null>;
  timeManager: TimeManager; // Add TimeManager
}

export function useTrackGestures({
  tracks,
  updateMidiBlock,
  addMidiBlock,
  removeMidiBlock,
  selectBlock,
  selectedBlockId,
  timelineAreaRef,
  timeManager,
}: UseTrackGesturesProps) {
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragEndBeat, setDragEndBeat] = useState(0);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);

  // State for context menu
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuBlockId, setContextMenuBlockId] = useState<string | null>(null);
  const [contextMenuTrackId, setContextMenuTrackId] = useState<string | null>(null);

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to find track and block
  const findTrackAndBlock = useCallback((blockId: string | null): { track: Track | null, block: MIDIBlock | null } => {
    if (!blockId) return { track: null, block: null };
    for (const track of tracks) {
      const block = track.midiBlocks.find(b => b.id === blockId);
      if (block) {
        return { track, block };
      }
    }
    return { track: null, block: null };
  }, [tracks]);

  // Helper to find track by ID (moved from component)
  const findTrackById = useCallback((trackId: string | null): Track | null => {
    if (!trackId) return null;
    return tracks.find(t => t.id === trackId) || null;
  }, [tracks]);

  // Handle key press for delete & escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const { track } = findTrackAndBlock(selectedBlockId);
        if (track) {
          removeMidiBlock(track.id, selectedBlockId);
          selectBlock(null); // Deselect after deleting
        }
      }
      // Escape key to close context menu
      if (e.key === 'Escape') {
        setShowContextMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBlockId, removeMidiBlock, tracks, findTrackAndBlock, selectBlock]);

  // Handle click outside context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Basic check if click is outside menu - improve if menu contains complex elements
      const target = event.target as HTMLElement;
      if (showContextMenu && !target.closest('.context-menu-class')) { // Add a class to your context menu div
         setShowContextMenu(false);
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]); // Only depends on showContextMenu

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
    selectBlock(blockId);
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
    selectBlock(blockId);
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

  const handleDoubleClick = useCallback((e: React.MouseEvent, trackId: string) => {
    const timelineAreaRect = timelineAreaRef.current?.getBoundingClientRect();
    if (!timelineAreaRect) return;

    const clickX = e.clientX - timelineAreaRect.left;
    const clickBeat = Math.floor(clickX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;

    const targetTrack = findTrackById(trackId);
    if (!targetTrack) return;

    const newBlock: MIDIBlock = {
      id: `block-${Date.now()}`,
      startBeat: clickBeat,
      endBeat: clickBeat + 4, // Default 4 beats long
      notes: []
    };

    addMidiBlock(targetTrack.id, newBlock);
    selectBlock(newBlock.id);
  }, [addMidiBlock, selectBlock, findTrackById, timelineAreaRef]);

  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string | null = null, trackId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();

    let targetTrackId: string | null = trackId;

    if (blockId) {
      const { track } = findTrackAndBlock(blockId);
      if (track) {
        targetTrackId = track.id;
        selectBlock(blockId);
      } else {
         console.error("Could not find track for context menu block");
         return;
      }
    } else if (!targetTrackId) {
        const timelineAreaRect = timelineAreaRef.current?.getBoundingClientRect();
        if (timelineAreaRect) {
            const clickY = e.clientY - timelineAreaRect.top;
            const trackIndex = Math.floor(clickY / TRACK_HEIGHT);
            if (tracks[trackIndex]) {
                targetTrackId = tracks[trackIndex].id;
            }
        }
        if (!targetTrackId) {
            console.error("Context menu opened without target track ID and couldn't determine from position");
            return;
        }
    }

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuBlockId(blockId);
    setContextMenuTrackId(targetTrackId);
    setShowContextMenu(true);

  }, [selectBlock, tracks, findTrackAndBlock, timelineAreaRef]);

  const handleDeleteBlock = useCallback(() => {
    if (contextMenuBlockId && contextMenuTrackId) {
      removeMidiBlock(contextMenuTrackId, contextMenuBlockId);
      setShowContextMenu(false);
      setContextMenuBlockId(null);
      setContextMenuTrackId(null);
      selectBlock(null); // Deselect after deleting via context menu
    }
  }, [contextMenuBlockId, contextMenuTrackId, removeMidiBlock, selectBlock]);

  const handleImportMidiClick = useCallback(() => {
    if (!contextMenuTrackId) {
        console.error("Cannot import MIDI: target track ID unknown.");
        setShowContextMenu(false);
        return;
    }
    fileInputRef.current?.click();
    setShowContextMenu(false);
  }, [contextMenuTrackId]);

  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetTrackId = contextMenuTrackId;

    if (event.target) event.target.value = '';

    if (!file || !targetTrackId) {
      console.error("MIDI file selected but target track ID is missing or file is invalid.");
      setContextMenuTrackId(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
            console.error('Failed to read MIDI file.');
            setContextMenuTrackId(null);
            return;
        }

        try {
            const parsedBlocks = await MidiParser.parse(arrayBuffer, timeManager);
            if (parsedBlocks.length > 0) {
                parsedBlocks.forEach(block => {
                    addMidiBlock(targetTrackId, block);
                });
            } else {
                 console.log("No valid note data found in MIDI file to create blocks.");
            }
        } catch (err) {
            console.error("Error parsing MIDI file:", err);
        } finally {
            setContextMenuTrackId(null);
        }
    };

    reader.onerror = () => {
        console.error('Error reading MIDI file.');
        setContextMenuTrackId(null);
    };

    reader.readAsArrayBuffer(file);

  }, [addMidiBlock, timeManager, contextMenuTrackId]);

  return {
    handleStartEdge,
    handleEndEdge,
    handleMoveBlock,
    handleDoubleClick,
    handleContextMenu,
    handleDeleteBlock,
    handleImportMidiClick,
    handleFileSelected,
    showContextMenu,
    contextMenuPosition,
    contextMenuBlockId,
    fileInputRef,
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