import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/store';
import { Track } from '../../lib/types';

interface InstrumentViewProps {
  track: Track;
  onDragStart?: (trackId: string, initialY: number, offsetY: number) => void;
  isDragging: boolean;
}

function InstrumentView({ track, onDragStart, isDragging }: InstrumentViewProps) {
  const { selectTrack, selectedTrackId, updateTrack } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(track.name || 'Untitled Track');
  const inputRef = useRef<HTMLInputElement>(null);
  const mouseDownRef = useRef(false);
  const potentialDragRef = useRef<{
    startX: number;
    startY: number;
    trackId: string;
    offsetY: number;
  } | null>(null);
  const dragStartedRef = useRef(false);
  const dragThreshold = 5; // pixels

  const isSelected = track.id === selectedTrackId;

  const handleClick = () => {
    if (!isEditing && !dragStartedRef.current) {
      selectTrack(track.id);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setInputValue(track.name || 'Untitled Track');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSave = () => {
    if (inputValue !== (track.name || 'Untitled Track')) {
      updateTrack(track.id, { name: inputValue || 'Untitled Track' });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(track.name || 'Untitled Track');
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing || e.button !== 0 || !onDragStart) {
      return;
    }
    if (inputRef.current && inputRef.current.contains(e.target as Node)) {
        return;
    }

    dragStartedRef.current = false;
    mouseDownRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    potentialDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        trackId: track.id,
        offsetY: offsetY
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!mouseDownRef.current || !potentialDragRef.current || !onDragStart || dragStartedRef.current) {
          return;
      }

      const dx = e.clientX - potentialDragRef.current.startX;
      const dy = e.clientY - potentialDragRef.current.startY;

      if (Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
          dragStartedRef.current = true;
          onDragStart(
              potentialDragRef.current.trackId,
              potentialDragRef.current.startY,
              potentialDragRef.current.offsetY
          );
          potentialDragRef.current = null;
          setIsEditing(false);
      }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      mouseDownRef.current = false;
      potentialDragRef.current = null;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (mouseDownRef.current && !dragStartedRef.current) {
           mouseDownRef.current = false;
           potentialDragRef.current = null;
      }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className="instrument-view"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={onDragStart ? handleMouseDown : undefined}
      onMouseMove={onDragStart ? handleMouseMove : undefined}
      onMouseUp={onDragStart ? handleMouseUp : undefined}
      onMouseLeave={onDragStart ? handleMouseLeave: undefined}
      style={{
        padding: '0 10px',
        height: '100%',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        color: '#ddd',
        backgroundColor: isSelected && !isDragging ? '#333' : '#1a1a1a',
        transition: 'background-color 0.1s ease, opacity 0.1s ease',
        minWidth: '150px',
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : (onDragStart ? 'cursor' : 'grabbing'),
        opacity: isDragging ? 0.8 : 1,
        userSelect: 'none',
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            padding: '0',
            margin: '0',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      ) : (
        <div onDoubleClick={handleDoubleClick} style={{ width: '100%', pointerEvents: isDragging ? 'none' : 'auto' }}>
          {track.name || 'Untitled Track'}
        </div>
      )}
    </div>
  );
}

export default InstrumentView; 