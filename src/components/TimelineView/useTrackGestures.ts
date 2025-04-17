import { useState, useEffect, useCallback, RefObject, useRef } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import { MidiParser } from '../../lib/MidiParser'; // Import MidiParser
import TimeManager from '../../lib/TimeManager'; // Import TimeManager type if needed

// Constants from TrackTimelineView - consider moving these to a shared location if used elsewhere
const GRID_SNAP = 0.25;

// Export the props interface
export interface UseTrackGesturesProps {
  tracks: Track[];
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
  addMidiBlock: (trackId: string, block: MIDIBlock) => void;
  removeMidiBlock: (trackId: string, blockId: string) => void;
  moveMidiBlock: (oldTrackId: string, newTrackId: string, block: MIDIBlock) => void;
  selectBlock: (blockId: string | null) => void;
  selectedBlockId: string | null;
  timelineAreaRef: RefObject<HTMLDivElement | null>;
  timeManager: TimeManager; // Add TimeManager
  // Zoom props
  horizontalZoom: number;
  verticalZoom: number;
  pixelsPerBeatBase: number;
  trackHeightBase: number;
}

export function useTrackGestures({
  tracks,
  updateMidiBlock,
  addMidiBlock,
  removeMidiBlock,
  moveMidiBlock,
  selectBlock,
  selectedBlockId,
  timelineAreaRef,
  timeManager,
  // Destructure zoom props
  horizontalZoom,
  verticalZoom,
  pixelsPerBeatBase,
  trackHeightBase,
}: UseTrackGesturesProps) {
  // Calculate effective values based on zoom
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const effectiveTrackHeight = trackHeightBase * verticalZoom;

  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDragTrackId, setOriginalDragTrackId] = useState<string | null>(null);

  const [dragInitialBlockState, setDragInitialBlockState] = useState<MIDIBlock | null>(null);
  const [pendingUpdateBlock, setPendingUpdateBlock] = useState<MIDIBlock | null>(null);
  const [pendingTargetTrackId, setPendingTargetTrackId] = useState<string | null>(null);

  // State for context menu
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuBlockId, setContextMenuBlockId] = useState<string | null>(null);
  const [contextMenuTrackId, setContextMenuTrackId] = useState<string | null>(null);

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to find track by ID
  const findTrackById = useCallback((trackId: string | null): Track | null => {
    if (!trackId) return null;
    return tracks.find(t => t.id === trackId) || null;
  }, [tracks]);

   // Helper to find track and block by block ID (used for delete, context menu, etc)
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


  // Handle key press for delete & escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const { track } = findTrackAndBlock(selectedBlockId);
        if (track) {
          removeMidiBlock(track.id, selectedBlockId);
          selectBlock(null);
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
      // Apply pending update only if a drag was active and there's a pending block
      if (dragOperation !== 'none' && pendingUpdateBlock && originalDragTrackId) {
         // Apply the pending update based on the operation type
         if (dragOperation === 'move' && pendingTargetTrackId && pendingTargetTrackId !== originalDragTrackId) {
             moveMidiBlock(originalDragTrackId, pendingTargetTrackId, pendingUpdateBlock);
         } else {
             updateMidiBlock(originalDragTrackId, pendingUpdateBlock);
         }
      }
      // Reset drag states
      setDragOperation('none');
      setOriginalDragTrackId(null);
      setDragInitialBlockState(null); // Reset initial block state
      setPendingUpdateBlock(null);
      setPendingTargetTrackId(null);
      setDragStartX(0); // Reset start X
    };

    const handleMouseMove = (e: MouseEvent) => {
       // Only proceed if a drag is active and we have the initial block state
      if (dragOperation === 'none' || !dragInitialBlockState || !originalDragTrackId || !timelineAreaRef.current) return;

      // Get the original block state directly
      const originalBlock = dragInitialBlockState;

      const timelineAreaRect = timelineAreaRef.current.getBoundingClientRect();
      if (!timelineAreaRect) return;

      const currentX = e.clientX;
      const currentY = e.clientY - timelineAreaRect.top;
      const deltaX = currentX - dragStartX;
      const deltaBeat = Math.round(deltaX / effectivePixelsPerBeat / GRID_SNAP) * GRID_SNAP;

      // Create a temporary block based on the *original* block's state
      let tempBlock = { ...originalBlock };
      let newStartBeat: number | undefined;
      let newEndBeat: number | undefined;
      let tempTargetTrackId = originalDragTrackId; // Start with original track

      if (dragOperation === 'start') {
        // Use the original block's endBeat and startBeat
        newStartBeat = Math.max(0, Math.min(originalBlock.endBeat - GRID_SNAP, originalBlock.startBeat + deltaBeat));
        tempBlock.startBeat = newStartBeat;
      } else if (dragOperation === 'end') {
        // Use the original block's startBeat and endBeat
        newEndBeat = Math.max(originalBlock.startBeat + GRID_SNAP, originalBlock.endBeat + deltaBeat);
        tempBlock.endBeat = newEndBeat;
      } else if (dragOperation === 'move') {
        const duration = originalBlock.endBeat - originalBlock.startBeat;
        // Use the original block's startBeat
        newStartBeat = Math.max(0, originalBlock.startBeat + deltaBeat);
        tempBlock.startBeat = newStartBeat;
        tempBlock.endBeat = newStartBeat + duration;

        // Determine target track based on vertical position
        const targetTrackIndex = Math.floor(Math.max(0, currentY) / effectiveTrackHeight);
        const potentialTargetTrack = tracks[targetTrackIndex];
        if (potentialTargetTrack) {
          tempTargetTrackId = potentialTargetTrack.id;
        }
      }

       // Update pending state
       setPendingUpdateBlock(tempBlock);
       setPendingTargetTrackId(tempTargetTrackId);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
      dragOperation, dragStartX, originalDragTrackId, dragInitialBlockState, // Use initial block state here
      updateMidiBlock, moveMidiBlock,
      timelineAreaRef,
      effectivePixelsPerBeat, effectiveTrackHeight,
      tracks,
      pendingUpdateBlock, pendingTargetTrackId,
      setPendingUpdateBlock, setPendingTargetTrackId
  ]);

  // Start resizing from the left edge
  const handleStartEdge = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('start');
    setDragStartX(clientX);
    setOriginalDragTrackId(trackId);
    setDragInitialBlockState({ ...block }); // Store copy of initial block state

    setPendingUpdateBlock({ ...block });
    setPendingTargetTrackId(trackId);
    selectBlock(blockId);
  }, [findTrackById, selectBlock]);

  // Start resizing from the right edge
  const handleEndEdge = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('end');
    setDragStartX(clientX);
    setOriginalDragTrackId(trackId);
    setDragInitialBlockState({ ...block });

    setPendingUpdateBlock({ ...block });
    setPendingTargetTrackId(trackId);
    selectBlock(blockId);
  }, [findTrackById, selectBlock]);

  // Start moving the block
  const handleMoveBlock = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('move');
    setDragStartX(clientX);
    setOriginalDragTrackId(trackId);
    setDragInitialBlockState({ ...block });

    setPendingUpdateBlock({ ...block });
    setPendingTargetTrackId(trackId);
    selectBlock(blockId);
  }, [findTrackById, selectBlock]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, trackId: string) => {
    if (dragOperation !== 'none') return;

    const timelineAreaRect = timelineAreaRef.current?.getBoundingClientRect();
    if (!timelineAreaRect) return;

    const clickX = e.clientX - timelineAreaRect.left;
    const clickBeat = Math.floor(clickX / effectivePixelsPerBeat / GRID_SNAP) * GRID_SNAP;

    const targetTrack = findTrackById(trackId);
    if (!targetTrack) return;

    const newBlock: MIDIBlock = {
      id: `block-${Date.now()}`,
      startBeat: clickBeat,
      endBeat: clickBeat + 4,
      notes: []
    };

    addMidiBlock(targetTrack.id, newBlock);
    selectBlock(newBlock.id);
  }, [addMidiBlock, selectBlock, findTrackById, timelineAreaRef, effectivePixelsPerBeat, dragOperation]);


  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string | null = null, trackId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();

    let targetTrackIdForMenu: string | null = trackId;

    if (blockId) {
      const { track } = findTrackAndBlock(blockId);
      if (track) {
        targetTrackIdForMenu = track.id;
        selectBlock(blockId);
      } else {
         console.error("Could not find track for context menu block");
         setShowContextMenu(false);
         return;
      }
    } else if (!targetTrackIdForMenu) {
        const timelineAreaRect = timelineAreaRef.current?.getBoundingClientRect();
        if (timelineAreaRect) {
            const clickY = e.clientY - timelineAreaRect.top;
            const trackIndex = Math.floor(clickY / effectiveTrackHeight);
            if (tracks[trackIndex]) {
                targetTrackIdForMenu = tracks[trackIndex].id;
            }
        }
        if (!targetTrackIdForMenu) {
             console.warn("Context menu opened without a specific track context.");
             setShowContextMenu(false);
             return;
        }
    }

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuBlockId(blockId);
    setContextMenuTrackId(targetTrackIdForMenu);
    setShowContextMenu(true);

  }, [selectBlock, tracks, findTrackAndBlock, timelineAreaRef, effectiveTrackHeight, dragOperation]);


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
    pendingUpdateBlock,
    pendingTargetTrackId,
    dragOperation
  };
}