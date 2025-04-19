import { useState, useEffect, useCallback, RefObject, useRef } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import { MidiParser } from '../../lib/MidiParser'; // Import MidiParser
import TimeManager from '../../lib/TimeManager'; // Import TimeManager type if needed
import { SelectedWindowType } from '../../store/uiSlice'; // <-- Import SelectedWindowType

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
  selectedWindow: SelectedWindowType; // <-- Add selectedWindow prop
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
  selectedWindow,
}: UseTrackGesturesProps) {
  // Calculate effective values based on zoom
  const effectivePixelsPerBeat = pixelsPerBeatBase * horizontalZoom;
  const effectiveTrackHeight = trackHeightBase * verticalZoom;

  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDragTrackId, setOriginalDragTrackId] = useState<string | null>(null);
  const [dragInitialBlockState, setDragInitialBlockState] = useState<MIDIBlock | null>(null);
  
  // State for visual feedback during drag
  const [pendingUpdateBlock, setPendingUpdateBlock] = useState<MIDIBlock | null>(null);
  const [pendingTargetTrackId, setPendingTargetTrackId] = useState<string | null>(null);

  // Refs to hold the latest pending state for use in stable event handlers
  const pendingUpdateBlockRef = useRef<MIDIBlock | null>(null);
  const pendingTargetTrackIdRef = useRef<string | null>(null);

  // Update refs whenever pending state changes (outside the main mouse handler effect)
  useEffect(() => {
      pendingUpdateBlockRef.current = pendingUpdateBlock;
      pendingTargetTrackIdRef.current = pendingTargetTrackId;
  }, [pendingUpdateBlock, pendingTargetTrackId]);

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
      // Delete/Backspace (only if timelineView is selected)
      if (selectedWindow === 'timelineView' && (e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        e.preventDefault(); // Prevent browser back navigation on Backspace
        const { track } = findTrackAndBlock(selectedBlockId);
        if (track) {
          removeMidiBlock(track.id, selectedBlockId);
          selectBlock(null);
        }
      }
      // Escape key: close context menu or cancel drag
      if (e.key === 'Escape') {
        if (showContextMenu) {
          setShowContextMenu(false);
        }
        // If a drag is in progress, Escape cancels it
        if (dragOperation !== 'none') {
          setDragOperation('none');
          setOriginalDragTrackId(null);
          setDragInitialBlockState(null);
          // Reset pending state for visual feedback
          setPendingUpdateBlock(null);
          setPendingTargetTrackId(null);
          // Refs will be updated by their own effect
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
      selectedBlockId, removeMidiBlock, tracks, findTrackAndBlock, selectBlock, // For delete
      showContextMenu, setShowContextMenu, // For context menu close
      dragOperation, setDragOperation, setOriginalDragTrackId, setDragInitialBlockState, // For drag cancel
      setPendingUpdateBlock, setPendingTargetTrackId, // Need setters for drag cancel reset
      selectedWindow
  ]);


  // Handle click outside context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showContextMenu && !target.closest('.context-menu-class')) {
         setShowContextMenu(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showContextMenu]);

  // --- Effect for handling mouse drag listeners --- 
  useEffect(() => {
    // Define handlers within the effect closure

    const handleMouseUp = () => {
      // Read the latest pending state from REFS
      const finalPendingBlock = pendingUpdateBlockRef.current;
      const finalTargetTrackId = pendingTargetTrackIdRef.current;
      const initialBlockState = dragInitialBlockState; // Get initial state captured on mouse down

      // Apply update only if drag was active and we have final state
      if (dragOperation !== 'none' && finalPendingBlock && originalDragTrackId && initialBlockState) {
         // --- Logic for adjusting notes on start resize --- 
         let blockToUpdate = finalPendingBlock;
         if (dragOperation === 'start') {
            const oldBlockStartBeat = initialBlockState.startBeat;
            const newBlockStartBeat = finalPendingBlock.startBeat;
            const deltaBlockStartBeat = newBlockStartBeat - oldBlockStartBeat;

            // Only adjust notes if the block start actually changed
            if (deltaBlockStartBeat !== 0) {
                console.log(`Adjusting note starts by ${-deltaBlockStartBeat} due to block start change of ${deltaBlockStartBeat}`);
                const adjustedNotes = finalPendingBlock.notes.map(note => ({
                    ...note,
                    // Adjust note's startBeat inversely to block's startBeat change
                    startBeat: note.startBeat - deltaBlockStartBeat 
                }));
                // Create a new block object with the adjusted notes
                blockToUpdate = { ...finalPendingBlock, notes: adjustedNotes };
            }
         }
         // --- End note adjustment logic --- 

         if (dragOperation === 'move' && finalTargetTrackId && finalTargetTrackId !== originalDragTrackId) {
             // Pass blockId, trackIds, and new beats to the corrected moveMidiBlock signature
             moveMidiBlock(
                 blockToUpdate.id, 
                 originalDragTrackId, 
                 finalTargetTrackId, 
                 blockToUpdate.startBeat, // Use potentially adjusted beats
                 blockToUpdate.endBeat
             );
         } else {
             // Use the potentially note-adjusted block for update (covers resize_start, resize_end, move within same track)
             updateMidiBlock(originalDragTrackId, blockToUpdate);
         }
      }

      // Reset drag states
      setDragOperation('none');
      setOriginalDragTrackId(null);
      setDragInitialBlockState(null);
      setPendingUpdateBlock(null); // Reset visual state
      setPendingTargetTrackId(null);
      setDragStartX(0);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Guard clauses using state read directly (these trigger the effect correctly)
      if (dragOperation === 'none' || !dragInitialBlockState || !originalDragTrackId || !timelineAreaRef.current) {
        return;
      }

      // Get the initial block state directly from state
      const originalBlock = dragInitialBlockState;

      const timelineAreaRect = timelineAreaRef.current.getBoundingClientRect();
      if (!timelineAreaRect) return;

      // Calculations based on current event and initial state
      const currentX = e.clientX;
      const currentY = e.clientY - timelineAreaRect.top;
      const deltaX = currentX - dragStartX;
      const deltaBeat = Math.round(deltaX / effectivePixelsPerBeat / GRID_SNAP) * GRID_SNAP;

      let tempBlock = { ...originalBlock };
      let newStartBeat: number | undefined;
      let newEndBeat: number | undefined;
      let tempTargetTrackId = originalDragTrackId;

      if (dragOperation === 'start') {
        newStartBeat = Math.max(0, Math.min(originalBlock.endBeat - GRID_SNAP, originalBlock.startBeat + deltaBeat));
        tempBlock.startBeat = newStartBeat;
      } else if (dragOperation === 'end') {
        newEndBeat = Math.max(originalBlock.startBeat + GRID_SNAP, originalBlock.endBeat + deltaBeat);
        tempBlock.endBeat = newEndBeat;
      } else if (dragOperation === 'move') {
        const duration = originalBlock.endBeat - originalBlock.startBeat;
        newStartBeat = Math.max(0, originalBlock.startBeat + deltaBeat);
        tempBlock.startBeat = newStartBeat;
        tempBlock.endBeat = newStartBeat + duration;

        const targetTrackIndex = Math.floor(Math.max(0, currentY) / effectiveTrackHeight);
        const potentialTargetTrack = tracks[targetTrackIndex];
        if (potentialTargetTrack) {
          tempTargetTrackId = potentialTargetTrack.id;
        }
      }

       // Update STATE for visual feedback
       setPendingUpdateBlock(tempBlock);
       setPendingTargetTrackId(tempTargetTrackId);
       // Refs will be updated by their separate effect
    };

    // Add listeners only when a drag operation starts
    if (dragOperation !== 'none') {
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        // console.log("Adding mouse listeners");
    }

    // Cleanup function
    return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
        // console.log("Removing mouse listeners");
    };
  }, [
      // Effect runs when drag operation changes or initial state is set/cleared
      dragOperation, dragStartX, originalDragTrackId, dragInitialBlockState,
      // Stable dependencies needed by handlers
      updateMidiBlock, moveMidiBlock, // Store actions
      timelineAreaRef,               // Ref to timeline area
      effectivePixelsPerBeat, effectiveTrackHeight, // Calculated geometry
      tracks,                        // Tracks array (for finding target track)
      // Setters are needed for resetting state in handleMouseUp
      setPendingUpdateBlock, setPendingTargetTrackId 
      // Note: We deliberately OMIT pendingUpdateBlock/pendingTargetTrackId states
      // and their refs to prevent listener churn. The latest values are accessed
      // via refs updated in a separate effect.
  ]);


  // --- Drag Start Handlers (wrapped in useCallback for potential optimization) --- 
  const handleStartEdge = useCallback((trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;

    setDragOperation('start');
    setDragStartX(clientX);
    setOriginalDragTrackId(trackId);
    setDragInitialBlockState({ ...block });
    // Initialize pending state for immediate visual feedback
    setPendingUpdateBlock({ ...block });
    setPendingTargetTrackId(trackId);
    selectBlock(blockId);
    // Refs will be updated by their effect
  }, [findTrackById, selectBlock]); // Dependencies: stable helpers + selectBlock prop

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

  // --- Other Handlers --- 
  const handleDoubleClick = useCallback((e: React.MouseEvent, trackId: string) => {
    if (dragOperation !== 'none') return; // Prevent during drag

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
  }, [addMidiBlock, selectBlock, findTrackById, timelineAreaRef, effectivePixelsPerBeat, GRID_SNAP, dragOperation]);


  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string | null = null, trackId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOperation !== 'none') return; // Prevent during drag

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
      selectBlock(null);
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
    const targetTrackId = contextMenuTrackId; // Read from state

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
            setContextMenuTrackId(null); // Clear the target ID after attempt
        }
    };

    reader.onerror = () => {
        console.error('Error reading MIDI file.');
        setContextMenuTrackId(null);
    };

    reader.readAsArrayBuffer(file);

  }, [addMidiBlock, timeManager, contextMenuTrackId]); // Dependency on contextMenuTrackId state

  // Return values from the hook
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
    // State needed for visual feedback
    pendingUpdateBlock,
    pendingTargetTrackId,
    dragOperation
  };
}