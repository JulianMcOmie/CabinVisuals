import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track, MIDIBlock } from '../../lib/types';
import useStore from '../../store/store';
import MidiBlockView from './MidiBlockView';
import { MidiParser } from '../../lib/MidiParser';

// Import TRACK_HEIGHT or define it if not easily importable
// Assuming TRACK_HEIGHT is defined elsewhere or passed as prop if variable
const TRACK_HEIGHT = 50; // Use the same height as in TimelineView

interface TrackTimelineViewProps {
  tracks: Track[]; // Changed from single track to array
}

// Constants
const PIXELS_PER_BEAT = 100; // Updated to match TimelineView and MeasuresHeader
const GRID_SNAP = 0.25; // Snap to 1/4 beat

function TrackTimelineView({ tracks }: TrackTimelineViewProps) { // Changed prop name
  const { selectedBlockId, numMeasures, selectBlock, addMidiBlock, updateMidiBlock, removeMidiBlock, timeManager } = useStore();
  const timelineAreaRef = useRef<HTMLDivElement>(null); // Renamed ref for clarity
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for drag operations
  const [dragOperation, setDragOperation] = useState<'none' | 'start' | 'end' | 'move'>('none');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartBeat, setDragStartBeat] = useState(0);
  const [dragEndBeat, setDragEndBeat] = useState(0);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null); // Store track ID during drag
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuBlockId, setContextMenuBlockId] = useState<string | null>(null);
  const [contextMenuTrackId, setContextMenuTrackId] = useState<string | null>(null); // Store track ID for context actions
  
  // Helper to find track and block
  const findTrackAndBlock = (blockId: string | null): { track: Track | null, block: MIDIBlock | null } => {
    if (!blockId) return { track: null, block: null };
    for (const track of tracks) {
      const block = track.midiBlocks.find(b => b.id === blockId);
      if (block) {
        return { track, block };
      }
    }
    return { track: null, block: null };
  };
  
  // Helper to find track by ID
   const findTrackById = (trackId: string | null): Track | null => {
    if (!trackId) return null;
    return tracks.find(t => t.id === trackId) || null;
  };
  
  // Handle key press for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const { track } = findTrackAndBlock(selectedBlockId); // Find track owning the selected block
        if (track) {
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
  }, [selectedBlockId, removeMidiBlock, tracks]); // Added tracks dependency
  
  // Handle mouse up to end all drag operations
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragOperation !== 'none') {
          setDragOperation('none');
          setDragBlockId(null);
          setDragTrackId(null); // Clear track ID on mouse up
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragOperation === 'none' || !dragBlockId || !dragTrackId) return;
      
      const track = findTrackById(dragTrackId);
      const block = track?.midiBlocks.find(b => b.id === dragBlockId);
      if (!block || !track) {
         console.error("Could not find track or block during drag move.");
         handleMouseUp(); // Abort drag if track/block is gone
         return;
      }
      
      const timelineAreaRect = timelineAreaRef.current?.getBoundingClientRect();
      if (!timelineAreaRect) return;
      
      const currentX = e.clientX;
      const deltaX = currentX - dragStartX;
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
  }, [dragOperation, dragStartX, dragBlockId, dragTrackId, dragStartBeat, dragEndBeat, updateMidiBlock, tracks]); // Added tracks dependency
  
  // Start resizing from the left edge
  const handleStartEdge = (trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;
    
    setDragOperation('start');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId); // Store track ID
    setDragStartBeat(block.startBeat);
  };
  
  // Start resizing from the right edge
  const handleEndEdge = (trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;
    
    setDragOperation('end');
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId); // Store track ID
    setDragEndBeat(block.endBeat);
  };
  
  // Start moving the block
  const handleMoveBlock = (trackId: string, blockId: string, clientX: number) => {
    const track = findTrackById(trackId);
    const block = track?.midiBlocks.find(b => b.id === blockId);
    if (!block || !track) return;
    
    setDragOperation('move');
    console.log("clientX: ", clientX);
    setDragStartX(clientX);
    setDragBlockId(blockId);
    setDragTrackId(trackId); // Store track ID
    setDragStartBeat(block.startBeat);
    selectBlock(blockId); // Also select the block being moved
  };
  
  // Handle double click to add a new MIDI block on a specific track
  const handleDoubleClick = (e: React.MouseEvent, trackId: string) => {
    console.log("handleDoubleClick: ", e, trackId);
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

    console.log("Adding block to track: ", targetTrack.id);
    
    addMidiBlock(targetTrack.id, newBlock);
    selectBlock(newBlock.id);
  };
  
  // Handle right click on the track background or a block
  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string | null = null, trackId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    let targetTrackId: string | null = trackId;

    // If right-clicked on a block, find its track
    if (blockId) {
      const { track } = findTrackAndBlock(blockId);
      if (track) {
        targetTrackId = track.id;
        selectBlock(blockId); // Select the block
      } else {
         console.error("Could not find track for context menu block");
         return; // Don't show menu if track not found
      }
    } else if (!targetTrackId) {
       console.error("Context menu opened without target track ID");
       return; // Don't show menu if no track context
    }

    // Position context menu at cursor position
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuBlockId(blockId);
    setContextMenuTrackId(targetTrackId); // Store the identified track ID
    setShowContextMenu(true);

  }, [selectBlock, tracks]); // Added tracks dependency
  
  // Handle delete from context menu
  const handleDeleteBlock = useCallback(() => {
    if (contextMenuBlockId && contextMenuTrackId) {
      removeMidiBlock(contextMenuTrackId, contextMenuBlockId);
      setShowContextMenu(false);
      setContextMenuBlockId(null);
      setContextMenuTrackId(null);
    }
  }, [contextMenuBlockId, contextMenuTrackId, removeMidiBlock]);

  // Handle clicking the "Import MIDI" context menu item
  const handleImportMidiClick = useCallback(() => {
    if (!contextMenuTrackId) {
        console.error("Cannot import MIDI: target track ID unknown.");
        setShowContextMenu(false);
        return;
    }
    fileInputRef.current?.click();
    setShowContextMenu(false);
  }, [contextMenuTrackId]); // Depends on the track ID stored from context menu open

  // Handle file selection from the hidden input
  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetTrackId = contextMenuTrackId;

    if (!file || !targetTrackId) {
      if (event.target) event.target.value = ''; // Clear input
      console.error("MIDI file selected but target track ID is missing.");
      setContextMenuTrackId(null); // Clear potentially stale ID
      return;
    }

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
                    console.log(`Adding block to track ${targetTrackId}: ${block.id}, Start: ${block.startBeat}, End: ${block.endBeat}, Notes: ${block.notes.length}`);
                    addMidiBlock(targetTrackId, block);
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
            setContextMenuTrackId(null); // Clear context menu track ID after import attempt
        }
    };

    reader.onerror = () => {
        console.error('Error reading MIDI file.');
        if (event.target) {
           event.target.value = '';
        }
        setContextMenuTrackId(null); // Clear context menu track ID on error
    };

    reader.readAsArrayBuffer(file);

  }, [addMidiBlock, timeManager, contextMenuTrackId]); // Depends on the context menu track ID

  return (
    <div 
      ref={timelineAreaRef}
      className="all-tracks-timeline-view"
      style={{
        position: 'relative',
        width: '100%',
        height: `${tracks.length * TRACK_HEIGHT}px`,
        backgroundColor: '#222',
        overflow: 'hidden',
      }}
    >
      <div className="grid-lines-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        {Array.from({ length: numMeasures * 4 }).map((_, i) => (
          <div key={`grid-${i}`} style={{
            position: 'absolute',
            left: `${i * PIXELS_PER_BEAT}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: i % 4 === 0 ? '#555' : '#333',
          }} />
        ))}
      </div>

      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="track-lane"
          style={{
            height: `${TRACK_HEIGHT}px`,
            borderBottom: '1px solid #333',
            position: 'relative',
            top: `${index * TRACK_HEIGHT}px`,
            left: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
          onDoubleClick={(e) => handleDoubleClick(e, track.id)}
          onContextMenu={(e) => handleContextMenu(e, null, track.id)}
        >
          {track.midiBlocks.map(block => (
            <div
              key={block.id}
              onContextMenu={(e) => handleContextMenu(e, block.id)}
            >
              <MidiBlockView
                block={block}
                trackId={track.id}
                isSelected={block.id === selectedBlockId}
                pixelsPerBeat={PIXELS_PER_BEAT}
                onSelectBlock={() => selectBlock(block.id)}
                onStartEdge={(tId, bId, clientX) => handleStartEdge(tId, bId, clientX)}
                onEndEdge={(tId, bId, clientX) => handleEndEdge(tId, bId, clientX)}
                onMoveBlock={(tId, bId, clientX) => handleMoveBlock(tId, bId, clientX)}
              />
            </div>
          ))}
        </div>
      ))}

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".mid,.midi"
        onChange={handleFileSelected}
      />

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
            onClick={handleImportMidiClick}
          >
            Import MIDI...
          </div>

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