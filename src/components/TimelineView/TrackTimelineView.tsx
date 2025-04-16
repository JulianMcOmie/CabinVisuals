import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
import MidiBlockView from './MidiBlockView';
import { MidiParser } from '../../lib/MidiParser';

interface TrackTimelineViewProps {
  track: Track;
}

// Constants
const PIXELS_PER_BEAT = 25; // 25px per beat
const GRID_SNAP = 0.25; // Snap to 1/4 beat

function TrackTimelineView({ track }: TrackTimelineViewProps) {
  const { selectedBlockId, numMeasures, selectBlock, addMidiBlock, updateMidiBlock, removeMidiBlock, timeManager } = useStore();
  const trackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragEndBeat, setDragEndBeat] = useState(0);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuBlockId, setContextMenuBlockId] = useState<string | null>(null);
  const [contextMenuTrackCoords, setContextMenuTrackCoords] = useState<{x: number, y: number} | null>(null);
  
  // Handle key press for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const selectedBlock = track.midiBlocks.find(block => block.id === selectedBlockId);
        if (selectedBlock) {
          removeMidiBlock(track.id, selectedBlockId);
        }
      }
      
      // Escape key to close context menu
      if (e.key === 'Escape') {
        setShowContextMenu(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Hide context menu on click outside
    const handleClickOutside = () => {
      setShowContextMenu(false);
    };
    
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [selectedBlockId, track.id, track.midiBlocks, removeMidiBlock]);
  
  // Handle mouse up to end all drag operations
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragOperation !== 'none') {
          setDragOperation('none');
          setDragBlockId(null);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragBlockId) return;
      
      const block = track.midiBlocks.find(b => b.id === dragBlockId);
      if (!block) return;
      
      const trackRect = trackRef.current?.getBoundingClientRect();
      if (!trackRect) return;
      
      const currentX = e.clientX;
      const deltaX = currentX - dragStartX;
      const deltaBeat = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
      
      let updatedBlock = { ...block };
      let newStartBeat: number | undefined;
      let newEndBeat: number | undefined;

      if (dragOperation === 'start') {
        newStartBeat = Math.max(0, Math.min(block.endBeat - GRID_SNAP, dragStartBeat + deltaBeat));
        if (newStartBeat !== updatedBlock.startBeat) {
            updatedBlock.startBeat = newStartBeat;
        }
      } else if (dragOperation === 'end') {
        newEndBeat = Math.max(block.startBeat + GRID_SNAP, dragEndBeat + deltaBeat);
         if (newEndBeat !== updatedBlock.endBeat) {
            updatedBlock.endBeat = newEndBeat;
        }
      } else if (dragOperation === 'move') {
        const duration = block.endBeat - block.startBeat;
        newStartBeat = Math.max(0, dragStartBeat + deltaBeat);
        if (newStartBeat !== updatedBlock.startBeat) {
            updatedBlock.startBeat = newStartBeat;
            updatedBlock.endBeat = newStartBeat + duration;
        }
      }

      // Only update if the block actually changed
      if (newStartBeat !== undefined && newStartBeat !== block.startBeat || 
          newEndBeat !== undefined && newEndBeat !== block.endBeat) {
           updateMidiBlock(track.id, updatedBlock);
      }
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragOperation, dragStartX, dragBlockId, dragStartBeat, dragEndBeat, track.id, track.midiBlocks, updateMidiBlock]);
  
  // Start resizing from the left edge
  const handleStartEdge = (blockId: string, clientX: number) => {
    const block = track.midiBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDragOperation('start');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragStartBeat(block.startBeat);
  };
  
  // Start resizing from the right edge
  const handleEndEdge = (blockId: string, clientX: number) => {
    const block = track.midiBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDragOperation('end');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragEndBeat(block.endBeat);
  };
  
  // Start moving the block
  const handleMoveBlock = (blockId: string, clientX: number) => {
    const block = track.midiBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDragOperation('move');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragStartBeat(block.startBeat);
  };
  
  // Handle double click to add a new MIDI block
  const handleDoubleClick = (e: React.MouseEvent) => {
    const trackRect = trackRef.current?.getBoundingClientRect();
    if (!trackRect) return;
    
    // Calculate beat position based on click position
    const clickX = e.clientX - trackRect.left;
    const clickBeat = Math.floor(clickX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
    
    // Create a new MIDI block at the clicked position
    const newBlock: MIDIBlock = {
      id: `block-${Date.now()}`,
      startBeat: clickBeat,
      endBeat: clickBeat + 4, // Default 4 beats long
      notes: []
    };
    
    addMidiBlock(track.id, newBlock);
    selectBlock(newBlock.id);
  };
  
  // Handle right click on the track background or a block
  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Position context menu at cursor position
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuBlockId(blockId);
    setContextMenuTrackCoords({x: e.clientX, y: e.clientY});
    setShowContextMenu(true);
    
    // Select the block if right-clicked on one
    if (blockId) {
        selectBlock(blockId);
    }
  }, [selectBlock]);
  
  // Handle delete from context menu
  const handleDeleteBlock = useCallback(() => {
    if (contextMenuBlockId) {
      removeMidiBlock(track.id, contextMenuBlockId);
      setShowContextMenu(false);
    }
  }, [contextMenuBlockId, track.id, removeMidiBlock]);

  // Handle clicking the "Import MIDI" context menu item
  const handleImportMidiClick = useCallback(() => {
    fileInputRef.current?.click();
    setShowContextMenu(false);
  }, []);

  // Handle file selection from the hidden input
  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
            console.error('Failed to read MIDI file.');
            return;
        }

        try {
            console.log("Parsing MIDI file...");
            const parsedBlocks = await MidiParser.parse(arrayBuffer, timeManager);
            console.log(`Parsed ${parsedBlocks.length} MIDI blocks.`);
            
            if (parsedBlocks.length > 0) {
                parsedBlocks.forEach(block => {
                    console.log(`Adding block: ${block.id}, Start: ${block.startBeat}, End: ${block.endBeat}, Notes: ${block.notes.length}`);
                    addMidiBlock(track.id, block);
                });
            } else {
                 console.log("No valid note data found in MIDI file to create blocks.");
            }

        } catch (err) {
            console.error("Error parsing MIDI file:", err);
        } finally {
            if (event.target) {
                 event.target.value = '';
            }
        }
    };

    reader.onerror = () => {
        console.error('Error reading MIDI file.');
        if (event.target) {
           event.target.value = '';
        }
    };

    reader.readAsArrayBuffer(file);

  }, [track.id, addMidiBlock, timeManager]);

  return (
    <div 
      ref={trackRef}
      className="track-timeline-view" 
      style={{
        height: '100%',
        borderBottom: '1px solid #333',
        position: 'relative',
        backgroundColor: '#222'
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* Grid lines - render vertical lines for measures */}
      {Array.from({ length: numMeasures * 4 }).map((_, i) => (
        <div key={`grid-${i}`} style={{
          position: 'absolute',
          left: `${i * PIXELS_PER_BEAT}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: i % 4 === 0 ? '#555' : '#333',
          zIndex: 0
        }} />
      ))}
      
      
      {/* Render MIDI blocks */}
      {track.midiBlocks.map(block => (
        <div 
          key={block.id} 
          onContextMenu={(e) => handleContextMenu(e, block.id)}
        >
          <MidiBlockView
            block={block}
            isSelected={block.id === selectedBlockId}
            pixelsPerBeat={PIXELS_PER_BEAT}
            onSelectBlock={selectBlock}
            onStartEdge={handleStartEdge}
            onEndEdge={handleEndEdge}
            onMoveBlock={handleMoveBlock}
          />
        </div>
      ))}
      

      {/* Hidden File Input for MIDI Upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".mid,.midi"
        onChange={handleFileSelected}
      />

      {/* Context menu */}
      {showContextMenu && (
        <div 
          style={{
            position: 'fixed',
            top: `${contextMenuPosition.y}px`,
            left: `${contextMenuPosition.x}px`,
            backgroundColor: '#333',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 100
          }}
          onClick={(e) => e.stopPropagation()}
        >
           {/* Import MIDI Option */}
           <div 
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '14px'
            }}
            onClick={handleImportMidiClick}
          >
            Import MIDI...
          </div>

          {/* Delete Block Option (only show if a block was right-clicked) */}
          {contextMenuBlockId && (
              <div 
                style={{
                  padding: '6px 14px',
                  cursor: 'pointer',
                  color: '#ff8080',
                  fontSize: '14px',
                  borderTop: '1px solid #555'
                }}
                onClick={handleDeleteBlock}
              >
                Delete Block
              </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrackTimelineView; 