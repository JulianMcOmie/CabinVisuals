import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store/store';
import { Track } from '../../lib/types';

interface InstrumentViewProps {
  track: Track;
}

function InstrumentView({ track }: InstrumentViewProps) {
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
      style={{
        padding: '0 10px',
        height: '100%',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        color: '#ddd',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#333' : '#1a1a1a',
        transition: 'background-color 0.1s ease',
        minWidth: '150px',
        boxSizing: 'border-box'
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
        <span onDoubleClick={handleDoubleClick} style={{ width: '100%' }}>
          {track.name || 'Untitled Track'}
        </span>
      )}
    </div>
  );
}

export default InstrumentView; 