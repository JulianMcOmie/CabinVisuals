import React from 'react';
import { MIDIBlock } from '../../lib/types';

interface MidiBlockViewProps {
  block: MIDIBlock;
  trackId: string;
  isSelected: boolean;
  pixelsPerBeat: number;
  onSelectBlock: (blockId: string) => void;
  onStartEdge: (trackId: string, blockId: string, clientX: number) => void;
  onEndEdge: (trackId: string, blockId: string, clientX: number) => void;
  onMoveBlock: (trackId: string, blockId: string, clientX: number) => void;
}

function MidiBlockView({
  block,
  trackId,
  isSelected,
  pixelsPerBeat,
  onSelectBlock,
  onStartEdge,
  onEndEdge,
  onMoveBlock
}: MidiBlockViewProps) {
  // Calculate position and width based on start/end beats
  const leftPosition = block.startBeat * pixelsPerBeat;
  const width = (block.endBeat - block.startBeat) * pixelsPerBeat;
  
  // Edge dragging handlers
  const handleLeftEdgeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdge(trackId, block.id, e.clientX);
  };
  
  const handleRightEdgeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEndEdge(trackId, block.id, e.clientX);
  };
  
  // Block move handler
  const handleMoveMouseDown = (e: React.MouseEvent) => {
    // Only initiate move if not clicking on the edges
    if (!e.currentTarget.classList.contains('edge')) {
      e.stopPropagation();
      onSelectBlock(block.id);
      onMoveBlock(trackId, block.id, e.clientX);
    }
  };

  return (
    <div 
      className="midi-block"
      style={{
        position: 'absolute',
        left: `${leftPosition}px`,
        top: '5px',
        width: `${width}px`,
        height: 'calc(100% - 10px)',
        backgroundColor: isSelected ? '#4a90e2' : '#67c23a',
        borderRadius: '4px',
        boxShadow: isSelected ? '0 0 0 2px white' : 'none',
        cursor: 'move',
        overflow: 'hidden',
        userSelect: 'none'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBlock(block.id);
      }}
      onMouseDown={handleMoveMouseDown}
    >
      {/* Left edge for resizing */}
      <div 
        className="edge left-edge"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '8px',
          height: '100%',
          cursor: 'w-resize'
        }}
        onMouseDown={handleLeftEdgeMouseDown}
      />
      
      {/* Block content */}
      <div style={{
        padding: '4px 12px',
        pointerEvents: 'none',
        color: 'white',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {block.notes.length} notes
      </div>
      
      {/* Right edge for resizing */}
      <div 
        className="edge right-edge"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '8px',
          height: '100%',
          cursor: 'e-resize'
        }}
        onMouseDown={handleRightEdgeMouseDown}
      />
    </div>
  );
}

export default MidiBlockView; 