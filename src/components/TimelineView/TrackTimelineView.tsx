import React, { useState, useRef, useEffect } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
import MidiBlockView from './MidiBlockView';

interface TrackTimelineViewProps {
  track: Track;
}

// Constants
const PIXELS_PER_BEAT = 25; // 25px per beat
const GRID_SNAP = 0.25; // Snap to 1/4 beat

const TrackTimelineView: React.FC<TrackTimelineViewProps> = ({ track }) => {
  const { selectedBlockId, selectBlock, addMidiBlock, updateMidiBlock, removeMidiBlock } = useStore();
  const trackRef = useRef<HTMLDivElement>(null);
  
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
      setDragOperation('none');
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragBlockId) return;
      
      const block = track.midiBlocks.find(b => b.id === dragBlockId);
      if (!block) return;
      
      const trackRect = trackRef.current?.getBoundingClientRect();
      if (!trackRect) return;
      
      const deltaX = e.clientX - dragStartX;
      const deltaBeat = Math.round(deltaX / PIXELS_PER_BEAT / GRID_SNAP) * GRID_SNAP;
      
      let updatedBlock = { ...block };
      
      if (dragOperation === 'start') {
        // Update start beat (don't go beyond end)
        const newStartBeat = Math.max(0, Math.min(block.endBeat - GRID_SNAP, dragStartBeat + deltaBeat));
        updatedBlock.startBeat = newStartBeat;
      } else if (dragOperation === 'end') {
        // Update end beat (don't go below start)
        const newEndBeat = Math.max(block.startBeat + GRID_SNAP, dragEndBeat + deltaBeat);
        updatedBlock.endBeat = newEndBeat;
      } else if (dragOperation === 'move') {
        // Move both start and end beats
        const duration = block.endBeat - block.startBeat;
        const newStartBeat = Math.max(0, dragStartBeat + deltaBeat);
        updatedBlock.startBeat = newStartBeat;
        updatedBlock.endBeat = newStartBeat + duration;
      }
      
      updateMidiBlock(track.id, updatedBlock);
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragOperation, dragStartX, dragBlockId, dragStartBeat, dragEndBeat, track, updateMidiBlock]);
  
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
  
  // Handle right click to show context menu
  const handleBlockRightClick = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Position context menu at cursor position
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuBlockId(blockId);
    setShowContextMenu(true);
    
    // Select the block
    selectBlock(blockId);
  };
  
  // Handle delete from context menu
  const handleDeleteBlock = () => {
    if (contextMenuBlockId) {
      removeMidiBlock(track.id, contextMenuBlockId);
      setShowContextMenu(false);
    }
  };

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
      onContextMenu={(e) => {
        // Prevent default context menu
        e.preventDefault();
      }}
    >
      {/* Grid lines - render vertical lines for measures */}
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${i * 100}px`, // 100px = 4 beats
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: i % 4 === 0 ? '#888' : '#ddd'
        }} />
      ))}
      
      {/* Beat markers (for more precise grid visualization) */}
      {Array.from({ length: 128 }).map((_, i) => (
        <div key={`beat-${i}`} style={{
          position: 'absolute',
          left: `${i * PIXELS_PER_BEAT}px`,
          top: 0,
          height: '3px',
          width: '1px',
          backgroundColor: '#555'
        }} />
      ))}
      
      {/* Render MIDI blocks */}
      {track.midiBlocks.map(block => (
        <div 
          key={block.id} 
          onContextMenu={(e) => handleBlockRightClick(e, block.id)}
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
          <div 
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '14px'
            }}
            onClick={handleDeleteBlock}
          >
            Delete Block
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackTimelineView; 