import React from 'react';

interface PianoKeysProps {
  keyCount: number;
  keyHeight: number;
}

// Constants
const LOWEST_NOTE = 21; // A0 MIDI note number

// Note names with and without accidentals
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // Indices of white keys (C, D, E, F, G, A, B)

const PianoKeys: React.FC<PianoKeysProps> = ({ keyCount, keyHeight }) => {
  const keys = [];

  for (let i = 0; i < keyCount; i++) {
    // Calculate MIDI note number (from the top)
    const noteNumber = LOWEST_NOTE + keyCount - 1 - i;
    
    // Get note information
    const octave = Math.floor(noteNumber / 12) - 1; // -1 because MIDI starts at C-1
    const noteIndex = noteNumber % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const isWhiteKey = WHITE_KEYS.includes(noteIndex);
    
    // Show note name only for C notes (beginning of octave)
    const showNoteName = noteIndex === 0;
    
    keys.push(
      <div
        key={`key-${noteNumber}`}
        style={{
          position: 'relative',
          height: `${keyHeight}px`,
          width: '100%',
          backgroundColor: isWhiteKey ? '#fff' : '#333',
          borderBottom: '1px solid #222',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '5px',
          fontSize: '8px',
          color: isWhiteKey ? '#333' : '#ccc'
        }}
      >
        {showNoteName && `${noteName}${octave}`}
      </div>
    );
  }

  return (
    <div className="piano-keys" style={{ height: '100%' }}>
      {keys}
    </div>
  );
};

export default PianoKeys; 