'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MIDIBlock, MIDINote } from '../../../lib/types';
import { SelectionBox, BLOCK_RESIZE_HANDLE_WIDTH, PLAYHEAD_DRAG_WIDTH, GRID_SNAP, BEATS_PER_MEASURE } from '../utils/constants';

import {
    handleNoteClick,
    handleSelectionBoxComplete,
    handleContextMenuOnNote
} from '../utils/clickOperations';
import {
    handleOptionDrag,
    handleDragMove,
    isDragThresholdMet,
    handleBlockResizeDrag
} from '../utils/dragOperations';
import { handleKeyboardShortcuts } from '../utils/keyboardHandlers';
import { findNoteAt } from '../utils/utils';

import { SelectedWindowType } from '../../../store/uiSlice';

interface UseMidiEditorInteractionsProps {
    block: MIDIBlock;
    trackId: string;
    selectedNoteIds: string[];
    setSelectedNoteIds: (ids: string[]) => void;
    updateMidiBlock: (trackId: string, block: MIDIBlock) => void;
    storeSelectNotes: (notes: MIDINote[]) => void;
    seekTo: (beat: number) => void;
    selectedWindow: string | null;
    pixelsPerBeat: number;
    pixelsPerSemitone: number;
    getCoordsAndDerivedCallback: (e: MouseEvent | React.MouseEvent) => {
        x: number; y: number; scrolledX: number; scrolledY: number; beat: number; pitch: number;
    } | null;
    currentBeat: number;
    numMeasures: number;
    blockStartBeat: number;
    blockDuration: number;
    setSelectedWindow: (window: SelectedWindowType) => void;
}

interface UseMidiEditorInteractionsReturn {
    handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleCanvasMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleCanvasContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    hoverCursor: CursorType;
    selectionBox: SelectionBox;
    isDragging: boolean;
}

// Define types locally within the hook
type CursorType = 'default' | 'move' | 'w-resize' | 'e-resize' | 'ew-resize' | 'col-resize';
type DragOperation = 'none' | 'move' | 'start' | 'end' | 'select' | 'resize-start' | 'resize-end' | 'drag-playhead';

export const useMidiEditorInteractions = ({
    block,
    trackId,
    selectedNoteIds,
    setSelectedNoteIds,
    updateMidiBlock,
    storeSelectNotes,
    seekTo,
    selectedWindow,
    pixelsPerBeat,
    pixelsPerSemitone,
    getCoordsAndDerivedCallback,
    currentBeat,
    numMeasures,
    blockStartBeat,
    blockDuration,
    setSelectedWindow
}: UseMidiEditorInteractionsProps): UseMidiEditorInteractionsReturn => {

    const [dragOperation, setDragOperation] = useState<DragOperation>('none');
    const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, elementX: 0, elementY: 0 });
    const [initialDragStates, setInitialDragStates] = useState<Map<string, { startBeat: number, duration: number }>>(new Map());
    const [dragNoteId, setDragNoteId] = useState<string | null>(null);
    const [clickOffset, setClickOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [hoverCursor, setHoverCursor] = useState<CursorType>('default');
    const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
    const [mouseDownButton, setMouseDownButton] = useState<number | null>(null);
    const [initialBlockState, setInitialBlockState] = useState<MIDIBlock | null>(null);
    const [copiedNotes, setCopiedNotes] = useState<MIDINote[]>([]);

    const blockRef = useRef(block);
    const selectedNoteIdsRef = useRef(selectedNoteIds);
    const dragOperationRef = useRef(dragOperation);
    const selectionBoxRef = useRef(selectionBox);
    const isDraggingRef = useRef(isDragging);
    const initialBlockStateRef = useRef(initialBlockState);
    const pixelsPerBeatRef = useRef(pixelsPerBeat);
    const pixelsPerSemitoneRef = useRef(pixelsPerSemitone);
    const currentBeatRef = useRef(currentBeat);

    useEffect(() => { blockRef.current = block; }, [block]);
    useEffect(() => { selectedNoteIdsRef.current = selectedNoteIds; }, [selectedNoteIds]);
    useEffect(() => { dragOperationRef.current = dragOperation; }, [dragOperation]);
    useEffect(() => { selectionBoxRef.current = selectionBox; setSelectionBox(selectionBox); }, [selectionBox, setSelectionBox]);
    useEffect(() => { selectionBoxRef.current = selectionBox; }, [selectionBox]);
    useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
    useEffect(() => { initialBlockStateRef.current = initialBlockState; }, [initialBlockState]);
    useEffect(() => { pixelsPerBeatRef.current = pixelsPerBeat; }, [pixelsPerBeat]);
    useEffect(() => { pixelsPerSemitoneRef.current = pixelsPerSemitone; }, [pixelsPerSemitone]);
    useEffect(() => { currentBeatRef.current = currentBeat; }, [currentBeat]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const currentDragOp = dragOperationRef.current;
            const currentBlock = blockRef.current;
            const currentInitialBlockState = initialBlockStateRef.current;
            const currentSelectionBox = selectionBoxRef.current;
            const currentPixelsPerBeat = pixelsPerBeatRef.current;
            const currentPixelsPerSemitone = pixelsPerSemitoneRef.current;
            const currentSelectedNoteIds = selectedNoteIdsRef.current;

            if (currentDragOp === 'none') return;

            const coords = getCoordsAndDerivedCallback(e);
            if (!coords) return;

            const { x, y, scrolledX, scrolledY } = coords;
            const currentBlockWidth = blockDuration * currentPixelsPerBeat;

            if (currentDragOp === 'select' && currentSelectionBox) {
                setSelectionBox({
                    ...currentSelectionBox,
                    endX: coords.scrolledX,
                    endY: coords.scrolledY
                });
                if (!isDraggingRef.current && isDragThresholdMet(dragStart.clientX, dragStart.clientY, e.clientX, e.clientY)) {
                    setIsDragging(true);
                }
                return;
            }

            if (currentDragOp === 'drag-playhead') {
                let newBeat = coords.scrolledX / currentPixelsPerBeat;
                newBeat = Math.round(newBeat);
                const maxBeat = numMeasures * BEATS_PER_MEASURE;
                newBeat = Math.max(0, Math.min(newBeat, maxBeat));
                seekTo(newBeat);
                return;
            }

            if ((currentDragOp === 'resize-start' || currentDragOp === 'resize-end') && currentInitialBlockState) {
                const updatedBlock = handleBlockResizeDrag(
                    currentInitialBlockState,
                    currentBlock,
                    currentDragOp,
                    { x: dragStart.elementX, y: dragStart.elementY },
                    coords,
                    currentPixelsPerBeat,
                    GRID_SNAP
                );
                if (JSON.stringify(updatedBlock) !== JSON.stringify(currentBlock)) {
                    updateMidiBlock(trackId, updatedBlock);
                }
                return;
            }

            if (!dragNoteId) return;

            if (!isDraggingRef.current) {
                if (isDragThresholdMet(dragStart.clientX, dragStart.clientY, e.clientX, e.clientY)) {
                    setIsDragging(true);
                } else {
                    return;
                }
            }
            
            if (currentDragOp === 'move' || currentDragOp === 'start' || currentDragOp === 'end') {
                const elementCoords = { x: coords.x, y: coords.y }; 
                const deltaX = e.clientX - dragStart.clientX; 
                const updatedBlock = handleDragMove(
                    currentBlock,
                    currentDragOp,
                    dragNoteId,
                    currentSelectedNoteIds,
                    elementCoords,
                    clickOffset,
                    dragStart,
                    initialDragStates,
                    currentPixelsPerBeat,
                    currentPixelsPerSemitone,
                    deltaX
                );
                if (JSON.stringify(updatedBlock) !== JSON.stringify(currentBlock)) {
                    updateMidiBlock(trackId, updatedBlock);
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            const currentDragOp = dragOperationRef.current;
            const currentBlock = blockRef.current;
            const currentSelectionBox = selectionBoxRef.current;
            const currentSelectedNoteIds = selectedNoteIdsRef.current;
            const currentPixelsPerBeat = pixelsPerBeatRef.current;
            const currentPixelsPerSemitone = pixelsPerSemitoneRef.current;

            if (currentDragOp === 'select' && mouseDownButton === 0) {
                if (currentSelectionBox) {
                    const coords = getCoordsAndDerivedCallback(e);
                    if (coords) {
                        const { action, newNote, selectedIds, selectedNotes } = handleSelectionBoxComplete(
                            currentBlock,
                            currentSelectionBox,
                            currentSelectedNoteIds,
                            isDraggingRef.current,
                            { beat: coords.beat, pitch: coords.pitch },
                            currentPixelsPerBeat,
                            currentPixelsPerSemitone
                        );

                        if (action === 'create-note' && newNote) {
                            const updatedBlock = { ...currentBlock, notes: [...currentBlock.notes, newNote] };
                            updateMidiBlock(trackId, updatedBlock);
                            setSelectedNoteIds([newNote.id]);
                            storeSelectNotes([newNote]);
                        } else {
                            setSelectedNoteIds(selectedIds);
                            storeSelectNotes(selectedNotes);
                        }
                    }
                }
            } else if ((currentDragOp === 'resize-start' || currentDragOp === 'resize-end')) {
                setInitialBlockState(null);
            }

            setDragNoteId(null);
            setDragOperation('none');
            setSelectionBox(null);
            setIsDragging(false);
            setMouseDownButton(null);
            setInitialBlockState(null);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedWindow !== 'midiEditor') return;
            handleKeyboardShortcuts(
                e,
                blockRef.current,
                selectedNoteIdsRef.current,
                copiedNotes,
                trackId,
                updateMidiBlock,
                setSelectedNoteIds,
                storeSelectNotes,
                setCopiedNotes
            );
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        trackId, updateMidiBlock, setSelectedNoteIds, storeSelectNotes, seekTo, 
        selectedWindow, numMeasures,
        getCoordsAndDerivedCallback,
        dragStart, dragNoteId, clickOffset, initialDragStates, mouseDownButton, copiedNotes, setCopiedNotes
    ]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        setSelectedWindow('midiEditor');
        setMouseDownButton(e.button);
        const currentBlock = blockRef.current;
        const currentPixelsPerBeat = pixelsPerBeatRef.current;
        const currentPixelsPerSemitone = pixelsPerSemitoneRef.current;
        const currentSelectedNoteIds = selectedNoteIdsRef.current;

        const coords = getCoordsAndDerivedCallback(e);
        if (!coords) return;

        const { x, y, scrolledX, scrolledY } = coords;
        const currentBlockWidth = blockDuration * currentPixelsPerBeat;

        if (e.button === 0) {
            const playheadX = currentBeatRef.current * currentPixelsPerBeat;
            if (scrolledX >= playheadX - PLAYHEAD_DRAG_WIDTH / 2 && scrolledX <= playheadX + PLAYHEAD_DRAG_WIDTH / 2) {
                setDragOperation('drag-playhead');
                setDragStart({ clientX: e.clientX, clientY: e.clientY, elementX: x, elementY: y });
                setIsDragging(false);
                e.stopPropagation();
                return;
            }
        }

        if (e.button === 0) {
            const blockStartX_px = blockStartBeat * currentPixelsPerBeat;
            const blockEndX_px = blockStartX_px + currentBlockWidth;
            if (scrolledX >= blockStartX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && scrolledX <= blockStartX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
                setDragOperation('resize-start');
                setDragStart({ clientX: e.clientX, clientY: e.clientY, elementX: x, elementY: y });
                setInitialBlockState({ ...currentBlock });
                setIsDragging(false);
                e.stopPropagation();
                return;
            } else if (scrolledX >= blockEndX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && scrolledX <= blockEndX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
                setDragOperation('resize-end');
                setDragStart({ clientX: e.clientX, clientY: e.clientY, elementX: x, elementY: y });
                setInitialBlockState({ ...currentBlock });
                setIsDragging(false);
                e.stopPropagation();
                return;
            }
        }

        const noteClickResult = findNoteAt(
            scrolledX, scrolledY, currentBlock.notes, currentSelectedNoteIds,
            currentPixelsPerBeat, currentPixelsPerSemitone, blockStartBeat, blockDuration
        );

        setDragStart({ clientX: e.clientX, clientY: e.clientY, elementX: x, elementY: y });
        setIsDragging(false);

        if (noteClickResult) {
            e.stopPropagation();
            const { note, area } = noteClickResult;
            const { selectedIds, selectedNotes, dragOperation: newDragOperation, cursorType, clickOffset: newClickOffset } = handleNoteClick(
                currentBlock, note, area, currentSelectedNoteIds, e.shiftKey, x, y, currentPixelsPerBeat, currentPixelsPerSemitone
            );

            setSelectedNoteIds(selectedIds);
            storeSelectNotes(selectedNotes);
            setDragNoteId(note.id);
            setDragOperation(newDragOperation);
            setHoverCursor(cursorType);
            setClickOffset(newClickOffset);

            const newStates = new Map<string, { startBeat: number; duration: number }>();
            selectedIds.forEach(id => {
                const selectedNote = currentBlock.notes.find(n => n.id === id);
                if (selectedNote) newStates.set(id, { startBeat: selectedNote.startBeat, duration: selectedNote.duration });
            });
            setInitialDragStates(newStates);

            if (e.altKey && newDragOperation === 'move') {
                const { updatedBlock, newSelectedIds, newDragNoteId, notesToSelect } = handleOptionDrag(currentBlock, selectedIds, note.id);
                updateMidiBlock(trackId, updatedBlock);
                setSelectedNoteIds(newSelectedIds);
                storeSelectNotes(notesToSelect);
                setDragNoteId(newDragNoteId);
                const duplicatedStates = new Map(newStates);
                notesToSelect.forEach(newNote => {
                    duplicatedStates.set(newNote.id, { startBeat: newNote.startBeat, duration: newNote.duration });
                });
                setInitialDragStates(duplicatedStates);
                setIsDragging(true);
            }
        } else {
            if (e.button === 0) {
                setDragOperation('select');
                setSelectionBox({ startX: scrolledX, startY: scrolledY, endX: scrolledX, endY: scrolledY });
                if (!e.shiftKey) {
                    setSelectedNoteIds([]);
                    storeSelectNotes([]);
                }
                setDragNoteId(null);
                setHoverCursor('default');
            }
        }
    }, [
        setSelectedWindow, getCoordsAndDerivedCallback, blockDuration, blockStartBeat, trackId, 
        updateMidiBlock, setSelectedNoteIds, storeSelectNotes,
        setMouseDownButton, setDragOperation, setDragStart, setInitialBlockState, 
        setIsDragging, setDragNoteId, setHoverCursor, setClickOffset, 
        setInitialDragStates, setSelectionBox
    ]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragOperationRef.current !== 'none') return;

        const coords = getCoordsAndDerivedCallback(e);
        if (!coords) {
            setHoverCursor('default');
            return;
        }

        const { scrolledX, scrolledY } = coords;
        const currentBlock = blockRef.current;
        const currentPixelsPerBeat = pixelsPerBeatRef.current;
        const currentPixelsPerSemitone = pixelsPerSemitoneRef.current;
        const currentSelectedNoteIds = selectedNoteIdsRef.current;
        const currentBlockWidth = blockDuration * currentPixelsPerBeat;

        const playheadX = currentBeatRef.current * currentPixelsPerBeat;
        if (scrolledX >= playheadX - PLAYHEAD_DRAG_WIDTH / 2 && scrolledX <= playheadX + PLAYHEAD_DRAG_WIDTH / 2) {
            setHoverCursor('col-resize');
            return;
        }

        const blockStartX_px = blockStartBeat * currentPixelsPerBeat;
        const blockEndX_px = blockStartX_px + currentBlockWidth;
        let isOverEdge = false;
        if (scrolledX >= blockStartX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && scrolledX <= blockStartX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
            setHoverCursor('ew-resize');
            isOverEdge = true;
        } else if (scrolledX >= blockEndX_px - BLOCK_RESIZE_HANDLE_WIDTH / 2 && scrolledX <= blockEndX_px + BLOCK_RESIZE_HANDLE_WIDTH / 2) {
            setHoverCursor('ew-resize');
            isOverEdge = true;
        }
        if (isOverEdge) return;

        const cursorResult = findNoteAt(
            scrolledX, scrolledY, currentBlock.notes, currentSelectedNoteIds,
            currentPixelsPerBeat, currentPixelsPerSemitone, blockStartBeat, blockDuration
        );

        if (cursorResult) {
            setHoverCursor(cursorResult.area === 'start' ? 'w-resize' : cursorResult.area === 'end' ? 'e-resize' : 'move');
        } else {
            setHoverCursor('default');
        }
    }, [
        getCoordsAndDerivedCallback, blockDuration, blockStartBeat, setHoverCursor
    ]);

    const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    }, []);

    const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        setSelectedWindow('midiEditor');
        const currentBlock = blockRef.current;
        const currentSelectedNoteIds = selectedNoteIdsRef.current;
        const currentPixelsPerBeat = pixelsPerBeatRef.current;
        const currentPixelsPerSemitone = pixelsPerSemitoneRef.current;

        const coords = getCoordsAndDerivedCallback(e);
        if (!coords) return;

        const result = findNoteAt(
            coords.scrolledX, coords.scrolledY, currentBlock.notes, currentSelectedNoteIds,
            currentPixelsPerBeat, currentPixelsPerSemitone, blockStartBeat, blockDuration
        );

        if (result) {
            const clickedNoteId = result.note.id;
            const wasSelected = currentSelectedNoteIds.includes(clickedNoteId);
            const updatedBlock = handleContextMenuOnNote(currentBlock, clickedNoteId, currentSelectedNoteIds);
            updateMidiBlock(trackId, updatedBlock);
            if (wasSelected) {
                setSelectedNoteIds([]);
                storeSelectNotes([]);
            }
        }
    }, [
        setSelectedWindow, getCoordsAndDerivedCallback, blockStartBeat, blockDuration, 
        trackId, updateMidiBlock, setSelectedNoteIds, storeSelectNotes
    ]);

    return {
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleCanvasContextMenu,
        hoverCursor,
        selectionBox, 
        isDragging    
    };
}; 