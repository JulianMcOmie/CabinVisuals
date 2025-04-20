'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../../store/store';
import { MIDIBlock, MIDINote, Track } from '../../lib/types';

// Import subcomponents
import PianoRollHeader from './components/PianoRollHeader';
import PianoKeys from './components/PianoKeys';

// Import utils
import {
  PIXELS_PER_BEAT,
  PIXELS_PER_SEMITONE,
  KEY_COUNT,
  SelectionBox,
  BEATS_PER_MEASURE,
  LOWEST_NOTE,
  RESIZE_HANDLE_WIDTH, // For note resize
  BLOCK_RESIZE_HANDLE_WIDTH,
  GRID_SNAP,
  MIN_PIXELS_PER_BEAT,
  MAX_PIXELS_PER_BEAT,
  ZOOM_SENSITIVITY
} from './utils/constants';

// --- ADDED: Vertical Zoom constants ---
const MIN_PIXELS_PER_SEMITONE = 5; // Example minimum height
const MAX_PIXELS_PER_SEMITONE = 50; // Example maximum height
// ---------------------------

import {
  getCoordsFromEvent,
  findNoteAt,
  generateNoteId
} from './utils/utils';

import { drawMidiEditor } from './utils/canvas';

import {
  handleNoteClick,
  handleSelectionBoxComplete,
  handleContextMenuOnNote
} from './utils/clickOperations';

import {
  handleOptionDrag,
  handleDragMove,
  isDragThresholdMet
} from './utils/dragOperations';

import { handleKeyboardShortcuts } from './utils/keyboardHandlers';

// Define CursorType including ew-resize
type CursorType = 'default' | 'move' | 'w-resize' | 'e-resize' | 'ew-resize';

// Define DragOperation type
type DragOperation = 'none' | 'move' | 'start' | 'end' | 'select' | 'resize-start' | 'resize-end';

interface MidiEditorProps {
  block: MIDIBlock;
  track: Track;
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}

function MidiEditor({ block, track }: MidiEditorProps) {
  const { 
    updateMidiBlock, 
    selectNotes: storeSelectNotes, 
    setSelectedWindow,
    selectedWindow,
    numMeasures
  } = useStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // --- Refs for animation frame drawing & state updates ---
  const drawAnimationFrameIdRef = useRef<number | null>(null);
  const isDrawPendingRef = useRef<boolean>(false);
  const dragUpdateAnimationFrameIdRef = useRef<number | null>(null);
  const dragUpdateScheduledRef = useRef<boolean>(false);
  const latestDraggedBlockRef = useRef<MIDIBlock | null>(null);
  // --------------------------------------------------------

  // --- NEW: State for reactive dimensions ---
  const [editorDimensions, setEditorDimensions] = useState({ width: 0, height: 0 });
  // -------------------------------------------

  // Use state dimensions, fallback if needed
  const editorWidth = editorDimensions.width || numMeasures * BEATS_PER_MEASURE * PIXELS_PER_BEAT; 
  const editorHeight = editorDimensions.height || KEY_COUNT * PIXELS_PER_SEMITONE;
  
  // --- NEW: Effect to listen for resize and update dimensions ---
  useEffect(() => {
    const editorElement = editorRef.current;
    if (!editorElement) return;

    // Function to update dimensions
    const updateDimensions = () => {
      setEditorDimensions({
        width: editorElement.clientWidth,
        height: editorElement.clientHeight,
      });
    };

    // Initial dimensions
    updateDimensions();

    // Debounced resize handler
    const handleResize = debounce(updateDimensions, 100); // Adjust debounce time as needed

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array: run once on mount
  // -------------------------------------------------------------

  // State for drag operations
  const [dragOperation, setDragOperation] = useState<DragOperation>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialDragStates, setInitialDragStates] = useState<Map<string, { startBeat: number, duration: number }>>(new Map());
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCursor, setHoverCursor] = useState<CursorType>('default');
  
  // Selection related state
  const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // --- ADDED: State to track mouse button on down --- 
  const [mouseDownButton, setMouseDownButton] = useState<number | null>(null);
  // -------------------------------------------------

  // --- ADDED: State to store block state on resize start ---
  const [initialBlockState, setInitialBlockState] = useState<MIDIBlock | null>(null);
  // ---------------------------------------------------------

  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(PIXELS_PER_BEAT); //useState(editorWidth / (numMeasures * BEATS_PER_MEASURE));
  const [pixelsPerSemitone, setPixelsPerSemitone] = useState(PIXELS_PER_SEMITONE); // Make this stateful for zoom
  
  // --- Refs for smooth vertical zoom scroll adjustment ---
  const zoomScrollAdjustmentRef = useRef({
    isAdjusting: false,
    mouseY: 0,
    proportionY: 0,
    mouseX: 0, // Added for horizontal
    proportionX: 0, // Added for horizontal
    zoomDimension: 'none' as 'x' | 'y' | 'none', // Added to track dimension
  });
  // ------------------------------------------------------
  
  // Copy/paste related state
  const [copiedNotes, setCopiedNotes] = useState<MIDINote[]>([]);

  // --- ADDED: Wheel Handler for Zoom --- 
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Check for Option key (Alt) or Ctrl key (often pinch-zoom)
    if (e.altKey || e.ctrlKey) {
      e.preventDefault(); // Prevent page scroll

      // Determine zoom direction and intensity (prioritize deltaX)
      const zoomIntensityX = Math.min(Math.abs(e.deltaX) / 50, 1); // Normalize intensity for X
      const zoomIntensityY = Math.min(Math.abs(e.deltaY) / 50, 1); // Normalize intensity for Y

      // Check if horizontal scroll magnitude is greater
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal Zoom
        setPixelsPerBeat((prevPixelsPerBeat: number) => {
          // --- Capture scroll state BEFORE zoom ---
          const gridElement = editorRef.current?.querySelector('.piano-roll-grid');
          if (gridElement) {
              const rect = gridElement.getBoundingClientRect();
              const mouseX = e.clientX - rect.left; // Mouse X relative to grid element
              const currentScrollX = gridElement.scrollLeft;
              const currentContentWidth = numMeasures * BEATS_PER_MEASURE * prevPixelsPerBeat;
              
              if (currentContentWidth > 0) { // Avoid division by zero
                zoomScrollAdjustmentRef.current = {
                  ...zoomScrollAdjustmentRef.current, // Preserve Y values
                  isAdjusting: true,
                  mouseX: mouseX,
                  proportionX: (mouseX + currentScrollX) / currentContentWidth,
                  zoomDimension: 'x',
                };
              } else {
                // If content width is 0, reset adjustment flags
                zoomScrollAdjustmentRef.current = { ...zoomScrollAdjustmentRef.current, isAdjusting: false, zoomDimension: 'none' };
              }
          }
          // ----------------------------------------

          let newPixelsPerBeat;
          if (e.deltaX < 0) {
            // Zoom In (Increase pixelsPerBeat)
            newPixelsPerBeat = prevPixelsPerBeat * Math.pow(ZOOM_SENSITIVITY, zoomIntensityX);
          } else {
            // Zoom Out (Decrease pixelsPerBeat)
            newPixelsPerBeat = prevPixelsPerBeat / Math.pow(ZOOM_SENSITIVITY, zoomIntensityX);
          }
          // Clamp the value within limits
          return Math.max(MIN_PIXELS_PER_BEAT, Math.min(MAX_PIXELS_PER_BEAT, newPixelsPerBeat));
        });
      } else if (e.deltaY !== 0) { // Only zoom vertically if there's vertical scroll
        // Vertical Zoom
        setPixelsPerSemitone((prevPixelsPerSemitone: number) => {
            // --- Capture scroll state BEFORE zoom ---
            const gridElement = editorRef.current?.querySelector('.piano-roll-grid');
            if (gridElement) {
                const rect = gridElement.getBoundingClientRect();
                const mouseY = e.clientY - rect.top; // Mouse Y relative to grid element
                const currentScrollY = gridElement.scrollTop;
                const currentContentHeight = KEY_COUNT * prevPixelsPerSemitone;
                
                if (currentContentHeight > 0) { // Avoid division by zero
                  zoomScrollAdjustmentRef.current = {
                    ...zoomScrollAdjustmentRef.current, // Preserve X values
                    isAdjusting: true,
                    mouseY: mouseY,
                    proportionY: (mouseY + currentScrollY) / currentContentHeight,
                    zoomDimension: 'y',
                  };
                } else {
                  // If content height is 0, reset adjustment
                  zoomScrollAdjustmentRef.current = { ...zoomScrollAdjustmentRef.current, isAdjusting: false, zoomDimension: 'none' };
                }
            }
            // ----------------------------------------

            let newPixelsPerSemitone;
            if (e.deltaY < 0) {
                // Zoom In (Increase pixelsPerSemitone)
                newPixelsPerSemitone = prevPixelsPerSemitone * Math.pow(ZOOM_SENSITIVITY, zoomIntensityY);
            } else {
                // Zoom Out (Decrease pixelsPerSemitone)
                newPixelsPerSemitone = prevPixelsPerSemitone / Math.pow(ZOOM_SENSITIVITY, zoomIntensityY);
            }
            // Clamp the value within limits
            const finalPixelsPerSemitone = Math.max(MIN_PIXELS_PER_SEMITONE, Math.min(MAX_PIXELS_PER_SEMITONE, newPixelsPerSemitone));
            // setScrollY(scrollY + finalPixelsPerSemitone - pixelsPerSemitone); // REMOVED: Automatic scroll adjustment during vertical zoom
            return finalPixelsPerSemitone;
        });
      }
    }
    // If neither Alt nor Ctrl is pressed, allow default scroll behavior (handled by onScroll)
  }, [setPixelsPerBeat, setPixelsPerSemitone]); // Dependencies: added setPixelsPerSemitone
  // -------------------------------------

  // --- ADDED: Effect to attach wheel listener with passive: false ---
  useEffect(() => {
    const gridElement = editorRef.current?.querySelector('.piano-roll-grid'); // Find the grid div
    if (gridElement) {
      // Type assertion needed because querySelector returns Element
      const wheelHandler = (e: Event) => handleWheel(e as unknown as React.WheelEvent<HTMLDivElement>); 
      gridElement.addEventListener('wheel', wheelHandler, { passive: false });

      return () => {
        gridElement.removeEventListener('wheel', wheelHandler);
      };
    }
  }, [handleWheel]); // Re-attach if handleWheel changes (due to dependencies)
  // --------------------------------------------------------------------

  const blockStartBeat = block.startBeat;
  const blockDuration = block.endBeat - block.startBeat;
  const blockWidth = blockDuration * pixelsPerBeat;
  const blockHeight = KEY_COUNT * pixelsPerSemitone;
  // --- ADDED: Calculate total grid width based on song measures --- 
  const totalGridWidth = numMeasures * BEATS_PER_MEASURE * pixelsPerBeat;
  const totalGridHeight = KEY_COUNT * pixelsPerSemitone;
  // ----------------------------------------------------------------
  
  // --- Define drawCanvas function (accesses state directly) ---
  const drawCanvas = useCallback(() => {
    isDrawPendingRef.current = false; // Allow next request
    drawAnimationFrameIdRef.current = null; // Clear the ID

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      // console.warn("Canvas or context not available for drawing.");
      return;
    }
    // Use calculated total grid dimensions
    if (!totalGridWidth || !totalGridHeight || totalGridWidth <= 0 || totalGridHeight <= 0) {
      // console.warn("Grid dimensions not available or invalid for drawing.");
      return; // Don't draw if dimensions aren't set or are invalid
    }
    
    // Get current state values needed for drawing (read fresh values)
    const currentBlock = block; // Use the latest block from state/props
    const currentSelectedIds = selectedNoteIds;
    const currentEditorWidth = editorDimensions.width; // Visible width
    const currentEditorHeight = editorDimensions.height; // Visible height
    const currentBlockDuration = currentBlock.endBeat - currentBlock.startBeat;
    const currentBlockStartBeat = currentBlock.startBeat;
    const currentSelectionBox = selectionBox;
    const currentIsDragging = isDragging;
    const currentPixelsPerBeat = pixelsPerBeat;
    const currentPixelsPerSemitone = pixelsPerSemitone;
    const currentScrollX = scrollX;
    const currentScrollY = scrollY;

    const dpr = window.devicePixelRatio || 1;
    // Set canvas bitmap size only if different
    if (canvas.width !== totalGridWidth * dpr) {
        canvas.width = totalGridWidth * dpr;
    }
    if (canvas.height !== totalGridHeight * dpr) {
        canvas.height = totalGridHeight * dpr;
    }
    // Set canvas display size (important for correct scaling)
    if (canvas.style.width !== `${totalGridWidth}px`) {
        canvas.style.width = `${totalGridWidth}px`; 
    }
    if (canvas.style.height !== `${totalGridHeight}px`) {
        canvas.style.height = `${totalGridHeight}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    // Clear canvas before redraw (only the visible part needed? Consider performance)
    // ctx.clearRect(currentScrollX, currentScrollY, currentEditorWidth, currentEditorHeight); 
    ctx.clearRect(0, 0, totalGridWidth, totalGridHeight); // Clear whole canvas for now

    ctx.translate(-currentScrollX, -currentScrollY);

    // Call the main drawing function from utils
    drawMidiEditor(
      ctx,
      currentBlock.notes,
      currentSelectedIds,
      currentEditorWidth, // Pass visible dimensions
      currentEditorHeight,
      currentBlockDuration,
      currentBlockStartBeat,
      totalGridWidth, // Pass total dimensions
      currentSelectionBox,
      currentIsDragging,
      currentPixelsPerBeat,
      currentPixelsPerSemitone
    );

    ctx.restore();
  }, [block, selectedNoteIds, editorDimensions, selectionBox, isDragging, pixelsPerBeat, pixelsPerSemitone, scrollX, scrollY, numMeasures, totalGridWidth, totalGridHeight]); // Include all dependencies read inside

  // --- Define requestDraw function ---
  const requestDraw = useCallback(() => {
    // Cancel any previously requested frame to avoid duplicate draws within the same event loop cycle
    if (drawAnimationFrameIdRef.current) {
        cancelAnimationFrame(drawAnimationFrameIdRef.current);
    }
    // Schedule the draw if one isn't already pending for the *next* frame
    if (!isDrawPendingRef.current) {
      isDrawPendingRef.current = true;
      drawAnimationFrameIdRef.current = requestAnimationFrame(drawCanvas);
    }
  }, [drawCanvas]); // Depends on drawCanvas

  // --- useEffect to trigger redraws on state changes --- 
  useEffect(() => {
    // Request a draw whenever relevant state changes
    requestDraw();
    // Dependencies are implicitly handled by the useCallback dependencies of requestDraw/drawCanvas
  }, [requestDraw]);

  // --- ADDED: useEffect for cleanup draw animation frame --- 
  useEffect(() => {
    // Cleanup function to cancel any pending draw animation frame on unmount
    return () => {
      if (drawAnimationFrameIdRef.current) {
        cancelAnimationFrame(drawAnimationFrameIdRef.current);
      }
      isDrawPendingRef.current = false; // Reset flag on unmount too
    };
  }, []); // Run only on mount and unmount
  // ------------------------------------------------------

  // Helper to get coords and derived values, adjusted for scroll
  const getCoordsAndDerived = (e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Adjust for scroll
    const scrolledX = mouseX + scrollX;
    const scrolledY = mouseY + scrollY;

    // Calculate beat and pitch based on SCROLLED coordinates
    const beat = scrolledX / pixelsPerBeat;
    // --- Use scrolledY for pitch calculation --- 
    const pitch = KEY_COUNT - Math.floor(scrolledY / pixelsPerSemitone) - 1 + LOWEST_NOTE;
    // -----------------------------------------

    if (isNaN(beat) || isNaN(pitch)) {
      // console.warn("NaN coordinate calculation", { mouseX, mouseY, scrollX, scrollY, pixelsPerBeat, pixelsPerSemitone });
      return null;
    }

    return {
      x: mouseX,       // Relative to element
      y: mouseY,       // Relative to element
      scrolledX,   // For content-space comparison
      scrolledY,   // For content-space comparison
      beat,        // Calculated from scrolled position
      pitch        // Calculated from scrolled position
    };
  };

  // Mouse event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSelectedWindow('midiEditor');
    setMouseDownButton(e.button);

    const coords = getCoordsAndDerived(e);
    if (!coords) return;
    
    const { x, y, scrolledX, scrolledY, beat, pitch } = coords; 

    // --- Check for Block Resize Click FIRST --- 
    if (e.button === 0) { // Only allow left-click resize
      const blockStartX_px = blockStartBeat * pixelsPerBeat;
      const blockEndX_px = blockStartX_px + blockWidth;

      if (scrolledX >= blockStartX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && 
          scrolledX <= blockStartX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
        // Start edge resize
        setDragOperation('resize-start');
        setDragStart({ x, y }); // Use element-relative coords for delta calculation
        setInitialBlockState({ ...block }); // Store initial block state
        e.stopPropagation();
        return;
      } else if (scrolledX >= blockEndX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && 
                 scrolledX <= blockEndX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
        // End edge resize
        setDragOperation('resize-end');
        setDragStart({ x, y });
        setInitialBlockState({ ...block });
        e.stopPropagation();
        return;
      }
    }
    // -----------------------------------------
    
    // If not resizing, proceed with note/selection logic
    const noteClickResult = findNoteAt(
      scrolledX,
      scrolledY,
      block.notes,
      selectedNoteIds,
      pixelsPerBeat,
      pixelsPerSemitone,
      blockStartBeat,
      blockDuration
    );
    
    setIsDragging(false);
    setDragStart({ x: x, y: y }); 
    
    if (noteClickResult) {
      // Clicked on a note
      e.stopPropagation();
      const { note, area } = noteClickResult;
      
      // Use the utility function to handle note click
      const { 
        selectedIds, 
        selectedNotes, 
        dragOperation: newDragOperation, 
        cursorType, 
        clickOffset: newClickOffset 
      } = handleNoteClick(
        block, 
        note, 
        area, 
        selectedNoteIds, 
        e.shiftKey, 
        x, 
        y,
        pixelsPerBeat,
        pixelsPerSemitone
      );
      
      // Update state based on results from utility function
      setSelectedNoteIds(selectedIds);
      storeSelectNotes(selectedNotes);
      setDragNoteId(note.id);
      setDragOperation(newDragOperation);
      setHoverCursor(cursorType);
      setClickOffset(newClickOffset);
      // Store initial drag states
      setInitialDragStates(prev => {
        const newStates = new Map(prev);
        // Store initial state for all selected notes
        selectedIds.forEach(id => {
          const selectedNote = block.notes.find(n => n.id === id);
          if (selectedNote) {
            newStates.set(id, { startBeat: selectedNote.startBeat, duration: selectedNote.duration });
          }
        });
        return newStates;
      });
      
      // Handle Option/Alt key for duplication at initial click
      if (e.altKey && newDragOperation === 'move') {
        const { 
          updatedBlock, 
          newSelectedIds, 
          newDragNoteId, 
          notesToSelect
        } = handleOptionDrag(block, selectedIds, note.id);
        
        // Apply state updates immediately
        updateMidiBlock(track.id, updatedBlock);
        setSelectedNoteIds(newSelectedIds);
        storeSelectNotes(notesToSelect);
        setDragNoteId(newDragNoteId);
        
        // Update initialDragStates for the newly created notes
        setInitialDragStates(prev => {
            const newStates = new Map(prev);
            notesToSelect.forEach(newNote => {
                newStates.set(newNote.id, { startBeat: newNote.startBeat, duration: newNote.duration });
            });
            return newStates;
        });

        setIsDragging(true); // Skip drag threshold check
      } else {
         // Update initialDragStates for non-duplicate drag start
          setInitialDragStates(prev => {
            const newStates = new Map(); // Start fresh for this selection
            selectedIds.forEach(id => {
              const selectedNote = block.notes.find(n => n.id === id);
              if (selectedNote) {
                newStates.set(id, { startBeat: selectedNote.startBeat, duration: selectedNote.duration });
              }
            });
            return newStates;
          });
      }
    } else {
      // Clicked on empty space
      if (e.button === 0) { // Only start selection on left click
        setDragOperation('select');
        // Use scrolled coordinates for the selection box
        setSelectionBox({ startX: scrolledX, startY: scrolledY, endX: scrolledX, endY: scrolledY }); 
        
        if (!e.shiftKey) {
          setSelectedNoteIds([]);
          storeSelectNotes([]);
        }
        
        setDragNoteId(null);
        setHoverCursor('default');
      }
    }
  };
  
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If we were dragging a note, the global mouseup already handles resetting state.
    // If we were creating a selection box, the global mouseup will handle completion.
    // This handler might not be strictly necessary anymore unless needed for other canvas-specific mouseup actions.
    // Keep it simple for now, global handler takes precedence.
    // console.log("handleCanvasMouseUp - Now likely handled by global listener");
  };
  
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setSelectedWindow('midiEditor');
    
    const coords = getCoordsAndDerived(e);
    if (!coords) return;
    
    const result = findNoteAt(
        coords.scrolledX,
        coords.scrolledY,
        block.notes, 
        selectedNoteIds, 
        pixelsPerBeat, 
        pixelsPerSemitone, 
        blockStartBeat, 
        blockDuration
    );
    if (result) {
      // Get the note ID that was clicked
      const clickedNoteId = result.note.id;
      // Check if this note was selected
      const wasSelected = selectedNoteIds.includes(clickedNoteId);

      // Call the utility function, passing the selected IDs
      const updatedBlock = handleContextMenuOnNote(block, clickedNoteId, selectedNoteIds);
      
      // Update the block in the store
      updateMidiBlock(track.id, updatedBlock);

      // If the clicked note was selected (meaning all selected notes were deleted), clear the selection
      if (wasSelected) {
        setSelectedNoteIds([]);
        storeSelectNotes([]);
      }
    }
  };
  
  // Modified canvasMouseMove to handle selection box updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordsAndDerived(e);
    if (!coords) {
      setHoverCursor('default');
      return;
    }
    
    const { x, y, scrolledX, scrolledY, beat, pitch } = coords; 
    
    if (dragOperation !== 'none') return; // Skip hover checks if any drag is active

    // Check for Block Resize Hover 
    const blockStartX_px = blockStartBeat * pixelsPerBeat;
    const blockEndX_px = blockStartX_px + blockWidth; 

    let isOverEdge = false;
    if (scrolledX >= blockStartX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && 
        scrolledX <= blockStartX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
      setHoverCursor('ew-resize');
      isOverEdge = true;
    } else if (scrolledX >= blockEndX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && 
               scrolledX <= blockEndX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
      setHoverCursor('ew-resize');
      isOverEdge = true;
    }
    
    if (isOverEdge) return; // Don't check notes if hovering edge

    // Handle Note Hover Cursor (if not over edge)
    const cursorResult = findNoteAt(
      scrolledX, 
      scrolledY, 
      block.notes, 
      selectedNoteIds, 
      pixelsPerBeat, 
      pixelsPerSemitone, 
      blockStartBeat, 
      blockDuration
    );
    
    if (cursorResult) {
      // Cursor is over a note, set the appropriate cursor style
      if (cursorResult.area === 'start') {
        setHoverCursor('w-resize');
      } else if (cursorResult.area === 'end') {
        setHoverCursor('e-resize');
      } else {
        setHoverCursor('move');
      }
    } else {
      // Not over a note or edge
      setHoverCursor('default');
    }
  };

  // Global mouse handlers and keyboard shortcuts
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle selection box updates first
      if (dragOperation === 'select' && selectionBox) {
        const coords = getCoordsAndDerived(e);
        if (!coords) return;
        
        // Update selection box using scrolled coordinates
        setSelectionBox({
          ...selectionBox,
          endX: coords.scrolledX, // Use scrolled coordinate
          endY: coords.scrolledY  // Use scrolled coordinate
        });
        
        // Check if drag threshold is met using utility function
        if (!isDragging && isDragThresholdMet(selectionBox.startX, selectionBox.startY, coords.x, coords.y)) {
          setIsDragging(true);
        }
        
        return;
      }
      
      // --- ADDED: Handle Block Resize Drag (Throttle state update) --- 
      if ((dragOperation === 'resize-start' || dragOperation === 'resize-end') && initialBlockState) {
        const derivedCoords = getCoordsAndDerived(e);
        if (!derivedCoords) return; 

        const deltaX = derivedCoords.x - dragStart.x; 
        const deltaBeat = Math.round(deltaX / pixelsPerBeat / GRID_SNAP) * GRID_SNAP;

        let tempBlock = { ...initialBlockState }; // Always calculate from initial state
  
        if (dragOperation === 'resize-start') {
          const originalEndBeat = initialBlockState.endBeat; 
          let newStartBeat = Math.max(0, initialBlockState.startBeat + deltaBeat);
          if (newStartBeat >= originalEndBeat - GRID_SNAP) { 
              newStartBeat = originalEndBeat - GRID_SNAP; 
          }
          tempBlock.startBeat = newStartBeat;
          const deltaBlockStartBeat = tempBlock.startBeat - initialBlockState.startBeat;
          // Adjust notes relative to the initial state
          tempBlock.notes = initialBlockState.notes.map(note => ({
              ...note,
              startBeat: note.startBeat - deltaBlockStartBeat
          }));
        } else { // resize-end
          const newEndBeat = Math.max(initialBlockState.startBeat + GRID_SNAP, initialBlockState.endBeat + deltaBeat);
          tempBlock.endBeat = newEndBeat;
          tempBlock.notes = initialBlockState.notes; // Notes don't move relative to block start
        }

        latestDraggedBlockRef.current = tempBlock; // Store the calculated state

        // Schedule state update using rAF
        if (!dragUpdateScheduledRef.current) {
          dragUpdateScheduledRef.current = true;
          dragUpdateAnimationFrameIdRef.current = requestAnimationFrame(() => {
            if (latestDraggedBlockRef.current) {
              updateMidiBlock(track.id, latestDraggedBlockRef.current);
              // Don't clear latestDraggedBlockRef here, allow mouseup to use final state if needed?
              // latestDraggedBlockRef.current = null; 
            }
            dragUpdateScheduledRef.current = false;
            dragUpdateAnimationFrameIdRef.current = null;
          });
        }
        return; // Handled block resize
      }
      // ----------------------------------------------------
      
      // Handle note modifications / block resize
      if (dragOperation === 'none') return;

      const derivedCoords = getCoordsAndDerived(e);
      if (!derivedCoords) return;
      
      // Handle NOTE modifications (move, resize start/end)
      if (!dragNoteId) return; // Only proceed if a note drag operation is active

      // Check if we've dragged enough to be considered a drag vs. click
      if (!isDragging) {
        if (isDragThresholdMet(dragStart.x, dragStart.y, derivedCoords.x, derivedCoords.y)) {
          setIsDragging(true);
          // Duplication logic (on drag start) is handled in mouseDown
        } else {
          return; // Don't start dragging yet
        }
      }
      
      // If dragging, calculate and schedule update
      if (dragOperation === 'move' || dragOperation === 'start' || dragOperation === 'end') {
        // Calculate the potential new state using the *current* block state 
        // This ensures calculations are based on the last *committed* state update, 
        // preventing potential compounding errors if rAF updates lag slightly.
        const potentialUpdatedBlock = handleDragMove(
          block, // Use the current block from state/props
          dragOperation,
          dragNoteId,
          selectedNoteIds,
          derivedCoords,
          clickOffset,
          dragStart,
          initialDragStates,
          pixelsPerBeat,
          pixelsPerSemitone
        );
        
        // Store the potentially updated block for the throttled update
        if (potentialUpdatedBlock !== block) { // Only update if changed
          latestDraggedBlockRef.current = potentialUpdatedBlock; 

          // Schedule state update only if one isn't already scheduled
          if (!dragUpdateScheduledRef.current) {
            dragUpdateScheduledRef.current = true;
            dragUpdateAnimationFrameIdRef.current = requestAnimationFrame(() => {
              if (latestDraggedBlockRef.current) {
                // Update state with the *latest* calculated block state from the ref
                updateMidiBlock(track.id, latestDraggedBlockRef.current);
                // Clear the stored block state *after* the update is sent
                // latestDraggedBlockRef.current = null; // Let mouseUp handle final clear?
              }
              dragUpdateScheduledRef.current = false; // Allow next update to be scheduled
              dragUpdateAnimationFrameIdRef.current = null; // Clear ID
            });
          }
        }
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // --- Cancel any pending drag update frame --- 
      if (dragUpdateAnimationFrameIdRef.current) {
        cancelAnimationFrame(dragUpdateAnimationFrameIdRef.current);
        dragUpdateAnimationFrameIdRef.current = null;
      }
      // --- Apply the VERY LAST calculated drag state on mouse up --- 
      // This ensures the final position is accurate, even if the last rAF didn't fire.
      if (latestDraggedBlockRef.current && (dragOperation === 'move' || dragOperation === 'start' || dragOperation === 'end' || dragOperation === 'resize-start' || dragOperation === 'resize-end')) {
        updateMidiBlock(track.id, latestDraggedBlockRef.current);
      }
      // -----------------------------------------------------------

      // Only process selection/creation if drag was 'select' AND it started with left button (0)
      if (dragOperation === 'select' && mouseDownButton === 0) { 
        if (selectionBox) {
          const derivedCoords = getCoordsAndDerived(e);

          if (derivedCoords) { 
            const { action, newNote, selectedIds, selectedNotes } = handleSelectionBoxComplete(
              block,
              selectionBox,
              selectedNoteIds, 
              isDragging, 
              { beat: derivedCoords.beat, pitch: derivedCoords.pitch }, 
              pixelsPerBeat, 
              pixelsPerSemitone
            );
            
            if (action === 'create-note' && newNote) {
              const updatedBlock = { ...block };
              updatedBlock.notes = [...block.notes, newNote];
              updateMidiBlock(track.id, updatedBlock);
              setSelectedNoteIds([newNote.id]);
              storeSelectNotes([newNote]);
            } else {
              setSelectedNoteIds(selectedIds);
              storeSelectNotes(selectedNotes);
            }
          } else {
              // console.warn("MouseUp for selection box occurred too far away to get coordinates.");
          }
        } 
      } // End of check for left-click selection

      // --- ADDED: Finalize Block Resize --- 
      else if ((dragOperation === 'resize-start' || dragOperation === 'resize-end') && initialBlockState) {
        // Just clear the initial state
        setInitialBlockState(null);
      }
      // ------------------------------------

      // Reset ALL drag operations and mouse button state regardless of button clicked
      setDragNoteId(null);
      setDragOperation('none'); 
      setSelectionBox(null); 
      setIsDragging(false);
      setMouseDownButton(null); 
      // --- ADDED: Also clear initial block state here just in case ---
      setInitialBlockState(null); 
      // --- ADDED: Clear drag update flag and stored state on mouse up --- 
      dragUpdateScheduledRef.current = false; 
      latestDraggedBlockRef.current = null; // Clear stored block state
      // ------------------------------------------------------------
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if this window is selected
      if (selectedWindow !== 'midiEditor') return;

      // Use the handler from keyboardHandlers.ts
      handleKeyboardShortcuts(
        e,
        block,
        selectedNoteIds,
        copiedNotes,
        track.id,
        updateMidiBlock,
        setSelectedNoteIds,
        storeSelectNotes,
        setCopiedNotes
      );
    };
    
    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp); // This listener now handles selection end
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    block, 
    track.id, 
    updateMidiBlock, 
    dragNoteId, 
    dragOperation, 
    dragStart,
    initialDragStates,
    selectionBox, 
    selectedNoteIds, 
    storeSelectNotes,
    isDragging,
    clickOffset,
    copiedNotes,
    setCopiedNotes,
    selectedWindow,
    pixelsPerBeat,
    pixelsPerSemitone,
    scrollX,
    scrollY,
    mouseDownButton,
    initialBlockState
  ]);

  const handleEditorClick = () => {
      setSelectedWindow('midiEditor');
  }
  
  return (
    <div
        ref={editorRef}
        className="midi-editor relative border border-gray-700 rounded-md"
        style={{ overflow: 'hidden', height: '100%' }}
        onClick={handleEditorClick}
    >
      <div className="piano-roll flex flex-col h-full">
        <div className="flex">
          <div className="piano-roll-header" style={{ overflow: 'hidden' }}>
            <PianoRollHeader 
              startBeat={block.startBeat} 
              endBeat={block.endBeat} 
              pixelsPerBeat={pixelsPerBeat} 
              scrollX={scrollX}
            />
          </div>
        </div>
        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          <div className="piano-keys" style={{ overflow: 'hidden', flexShrink: 0 }}>
            <PianoKeys 
              keyCount={KEY_COUNT} 
              keyHeight={pixelsPerSemitone} 
              scrollY={scrollY}
            />
          </div>
          <div
            className="piano-roll-grid relative"
            style={{
              width: `${editorWidth}px`,
              overflow: 'scroll',
              height: '100%'
            }}
            onScroll={(e) => {
              // Prevent scroll state update if we are programmatically adjusting scroll during zoom
              if (zoomScrollAdjustmentRef.current.isAdjusting) {
                return; 
              }
              // Update both scroll states
              setScrollX(e.currentTarget.scrollLeft);
              setScrollY(e.currentTarget.scrollTop);
            }}
          >
            <canvas
              ref={canvasRef} 
              style={{
                display: 'block',
                width: `${totalGridWidth}px`,   // Full content width
                height: `${blockHeight}px`, // Full content height
                cursor: hoverCursor,
                willChange: 'transform' 
              }}
              // Width/Height attributes are set in drawCanvas
              onMouseDown={handleCanvasMouseDown}
              onMouseUp={handleCanvasMouseUp}
              onMouseMove={handleCanvasMouseMove}
              onContextMenu={handleCanvasContextMenu}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MidiEditor; 