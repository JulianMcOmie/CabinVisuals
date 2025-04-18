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

  const isSelected = track.id === selectedTrackId;

  const handleClick = () => {
    if (!isEditing) {
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
    if (!isEditing && e.button === 0 && onDragStart) {
      if (inputRef.current && inputRef.current.contains(e.target as Node)) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const elementTopY = rect.top;
      const elementBottomY = rect.bottom;
      const offsetY = e.clientY - elementTopY;

      onDragStart(track.id, e.clientY, offsetY);
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
      onMouseDown={onDragStart ? handleMouseDown : undefined}
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
        cursor: isEditing ? 'text' : (onDragStart ? 'grab' : 'grabbing'),
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
        <span onDoubleClick={handleDoubleClick} style={{ width: '100%', pointerEvents: isDragging ? 'none' : 'auto' }}>
          {track.name || 'Untitled Track'}
        </span>
      )}
    </div>
  );
}

export default InstrumentView; 