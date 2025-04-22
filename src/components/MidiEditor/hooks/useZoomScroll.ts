/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    MIN_PIXELS_PER_BEAT,
    MAX_PIXELS_PER_BEAT,
    PIXELS_PER_BEAT as DEFAULT_PIXELS_PER_BEAT, // Rename default import
    PIXELS_PER_SEMITONE as DEFAULT_PIXELS_PER_SEMITONE, // Rename default import
    ZOOM_SENSITIVITY,
    KEY_COUNT,
    BEATS_PER_MEASURE
} from '../utils/constants';
import { debounce } from '../utils/utils'; // Import debounce from utils.ts

// --- Define Vertical Zoom constants locally --- 
const MIN_PIXELS_PER_SEMITONE = 5; // Example minimum height
const MAX_PIXELS_PER_SEMITONE = 50; // Example maximum height
// -------------------------------------------

interface UseZoomScrollProps {
    editorRef: React.RefObject<HTMLDivElement | null>; // Allow null in ref
    numMeasures: number;
    // Optional initial values if needed later
    // initialPixelsPerBeat?: number;
    // initialPixelsPerSemitone?: number;
}

export const useZoomScroll = ({
    editorRef,
    numMeasures
}: UseZoomScrollProps) => {
    const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PIXELS_PER_BEAT);
    const [pixelsPerSemitone, setPixelsPerSemitone] = useState(DEFAULT_PIXELS_PER_SEMITONE);
    const [scrollX, setScrollX] = useState(0);
    const [scrollY, setScrollY] = useState(0);

    const zoomScrollAdjustmentRef = useRef({
        isAdjusting: false,
        mouseY: 0,
        proportionY: 0,
        mouseX: 0,
        proportionX: 0,
        zoomDimension: 'none' as 'x' | 'y' | 'none',
    });

    // Wheel Handler for Zoom and Scroll Forwarding
    const handleWheel = useCallback((e: WheelEvent) => {
        const gridElement = editorRef.current?.querySelector('.piano-roll-grid');
        if (!gridElement) return; // Need grid element for scroll/zoom logic

        // Check for Option key (Alt) or Ctrl key (often pinch-zoom)
        if (e.altKey || e.ctrlKey) {
            e.preventDefault(); // Prevent page scroll ONLY when zooming

            const zoomIntensityX = Math.min(Math.abs(e.deltaX) / 50, 1);
            const zoomIntensityY = Math.min(Math.abs(e.deltaY) / 50, 1);

            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                // Horizontal Zoom
                setPixelsPerBeat((prevPixelsPerBeat) => {
                    const mouseX = e.clientX - gridElement.getBoundingClientRect().left;
                    const currentScrollX = gridElement.scrollLeft;
                    const currentContentWidth = numMeasures * BEATS_PER_MEASURE * prevPixelsPerBeat;

                    if (currentContentWidth > 0) {
                        zoomScrollAdjustmentRef.current = {
                            ...zoomScrollAdjustmentRef.current,
                            isAdjusting: true,
                            mouseX: mouseX,
                            proportionX: (mouseX + currentScrollX) / currentContentWidth,
                            zoomDimension: 'x',
                        };
                    } else {
                        zoomScrollAdjustmentRef.current = { ...zoomScrollAdjustmentRef.current, isAdjusting: false, zoomDimension: 'none' };
                    }

                    let newPixelsPerBeat = prevPixelsPerBeat * (e.deltaX < 0 ? Math.pow(ZOOM_SENSITIVITY, zoomIntensityX) : 1 / Math.pow(ZOOM_SENSITIVITY, zoomIntensityX));
                    return Math.max(MIN_PIXELS_PER_BEAT, Math.min(MAX_PIXELS_PER_BEAT, newPixelsPerBeat));
                });
            } else if (e.deltaY !== 0) {
                // Vertical Zoom
                setPixelsPerSemitone((prevPixelsPerSemitone) => {
                    const mouseY = e.clientY - gridElement.getBoundingClientRect().top;
                    const currentScrollY = gridElement.scrollTop;
                    const currentContentHeight = KEY_COUNT * prevPixelsPerSemitone;

                    if (currentContentHeight > 0) {
                        zoomScrollAdjustmentRef.current = {
                            ...zoomScrollAdjustmentRef.current,
                            isAdjusting: true,
                            mouseY: mouseY,
                            proportionY: (mouseY + currentScrollY) / currentContentHeight,
                            zoomDimension: 'y',
                        };
                    } else {
                        zoomScrollAdjustmentRef.current = { ...zoomScrollAdjustmentRef.current, isAdjusting: false, zoomDimension: 'none' };
                    }

                    let newPixelsPerSemitone = prevPixelsPerSemitone * (e.deltaY < 0 ? Math.pow(ZOOM_SENSITIVITY, zoomIntensityY) : 1 / Math.pow(ZOOM_SENSITIVITY, zoomIntensityY));
                    return Math.max(MIN_PIXELS_PER_SEMITONE, Math.min(MAX_PIXELS_PER_SEMITONE, newPixelsPerSemitone));
                });
            }
        } else {
            // --- Normal Scroll Forwarding --- 
            // Check if the event target is within the piano keys area
            const keysElement = editorRef.current?.querySelector('.piano-keys');
            let targetElement = e.target as Element | null;
            let isScrollOverKeys = false;
            while (targetElement && targetElement !== editorRef.current) {
                if (targetElement === keysElement) {
                    isScrollOverKeys = true;
                    break;
                }
                targetElement = targetElement.parentElement;
            }

            if (isScrollOverKeys) {
                // Manually forward scroll delta to the grid element
                gridElement.scrollTop += e.deltaY;
                gridElement.scrollLeft += e.deltaX;
                // Prevent the browser's default scroll action for this event,
                // as we are handling it manually by forwarding to the grid.
                e.preventDefault(); 
            }
            // If not over keys (presumably over the grid), allow default browser scroll
            // which should target the grid element correctly.
            // --------------------------------
        }
    }, [numMeasures, editorRef]); // Dependencies

    // Effect to attach wheel listener with passive: false
    useEffect(() => {
        // Attach listener to the main editor container referenced by editorRef
        const editorElement = editorRef.current;
        // const gridElement = editorRef.current?.querySelector('.piano-roll-grid'); // No longer query here for listener
        
        if (editorElement) { // Check if the main editor element exists
            // Type assertion needed because addEventListener expects EventListener type
            const wheelHandler = (e: Event) => handleWheel(e as WheelEvent); 
            // Add listener to the main container
            editorElement.addEventListener('wheel', wheelHandler, { passive: false });

            return () => {
                // Remove listener from the main container
                editorElement.removeEventListener('wheel', wheelHandler);
            };
        }
    }, [editorRef, handleWheel]); // Re-attach if handleWheel or editorRef changes

    // Effect for smooth zoom scroll adjustment
    useEffect(() => {
        const adjustmentRef = zoomScrollAdjustmentRef.current;
        if (adjustmentRef.isAdjusting) {
            const gridElement = editorRef.current?.querySelector('.piano-roll-grid');
            if (gridElement) {
                const { mouseX, proportionX, mouseY, proportionY, zoomDimension } = adjustmentRef;
                const viewportHeight = gridElement.clientHeight;
                const viewportWidth = gridElement.clientWidth;

                adjustmentRef.isAdjusting = true; // Ensure flag is set for duration

                if (zoomDimension === 'x') {
                    const newContentWidth = numMeasures * BEATS_PER_MEASURE * pixelsPerBeat;
                    let targetScrollX = (proportionX * newContentWidth) - mouseX;
                    targetScrollX = Math.max(0, Math.min(targetScrollX, newContentWidth - viewportWidth));
                    if (!isNaN(targetScrollX) && isFinite(targetScrollX)) {
                        gridElement.scrollLeft = targetScrollX;
                    } else {
                        console.warn("Calculated invalid targetScrollX", { proportionX, newContentWidth, mouseX, targetScrollX });
                    }
                } else if (zoomDimension === 'y') {
                    const newContentHeight = KEY_COUNT * pixelsPerSemitone;
                    let targetScrollY = (proportionY * newContentHeight) - mouseY;
                    targetScrollY = Math.max(0, Math.min(targetScrollY, newContentHeight - viewportHeight));
                    if (!isNaN(targetScrollY) && isFinite(targetScrollY)) {
                        gridElement.scrollTop = targetScrollY;
                    } else {
                        console.warn("Calculated invalid targetScrollY", { proportionY, newContentHeight, mouseY, targetScrollY });
                    }
                }
            }

            const timeoutId = setTimeout(() => {
                if (zoomScrollAdjustmentRef.current) {
                    zoomScrollAdjustmentRef.current.isAdjusting = false;
                    zoomScrollAdjustmentRef.current.zoomDimension = 'none';
                }
            }, 0); // Delay allows scroll event triggered by programmatic scroll to be ignored

            return () => clearTimeout(timeoutId);
        }
    }, [pixelsPerBeat, pixelsPerSemitone, numMeasures, editorRef]); // Dependencies // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll handler for the grid element
    const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        // Prevent scroll state update if we are programmatically adjusting scroll during zoom
        if (zoomScrollAdjustmentRef.current.isAdjusting) {
            return;
        }
        // setScrollX(e.currentTarget.scrollLeft);
        // setScrollY(e.currentTarget.scrollTop);
    }, []); // No dependencies needed as it only uses the ref and setters

    return {
        pixelsPerBeat,
        pixelsPerSemitone,
        scrollX,
        scrollY,
        handleGridScroll, // Expose the scroll handler for the grid element
        // We don't need to expose the setters unless MidiEditor needs to programmatically set zoom/scroll
    };
}; 