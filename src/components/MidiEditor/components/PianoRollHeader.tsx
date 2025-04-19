import React from 'react';

interface PianoRollHeaderProps {
  startBeat: number;
  endBeat: number;
  pixelsPerBeat: number;
  scrollX?: number;
}

function PianoRollHeader({ 
  startBeat, 
  endBeat, 
  pixelsPerBeat, 
  scrollX = 0
}: PianoRollHeaderProps) {
  const duration = endBeat - startBeat;
  
  return (
    <div 
      className="piano-roll-header"
      style={{
        position: 'relative',
        height: '100%',
        width: `${duration * pixelsPerBeat}px`
      }}
    >
      <div 
        style={{
          transform: `translateX(-${scrollX}px)`,
          position: 'relative',
          height: '100%',
          width: '100%'
        }}
      >
        {/* Render beat numbers */}
        {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
          const beat = startBeat + i;
          const isMeasureStart = beat % 4 === 0;
          
          // Only show labels for measure starts and visible area
          return (
            <div
              key={`beat-${beat}`}
              style={{
                position: 'absolute',
                left: `${(beat - startBeat) * pixelsPerBeat}px`,
                top: isMeasureStart ? '2px' : '15px',
                fontSize: isMeasureStart ? '12px' : '10px',
                color: isMeasureStart ? 'white' : '#999',
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            >
              {/* {isMeasureStart ? Math.floor(beat / 4) + 1 : beat % 4 + 1} */}
            </div>
          );
        })}
        
        {/* Render beat markers/ticks */}
        {Array.from({ length: Math.ceil(duration * 4) + 1 }).map((_, i) => {
          const quarterBeat = startBeat + i * 0.25;
          const isBeatStart = i % 4 === 0;
          const isMeasureStart = i % 16 === 0;
          
          return (
            <div
              key={`tick-${i}`}
              style={{
                position: 'absolute',
                left: `${(quarterBeat - startBeat) * pixelsPerBeat}px`,
                bottom: 0,
                width: '1px',
                height: isMeasureStart ? '15px' : isBeatStart ? '10px' : '5px',
                backgroundColor: isMeasureStart ? 'white' : isBeatStart ? '#aaa' : '#666'
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default PianoRollHeader; 