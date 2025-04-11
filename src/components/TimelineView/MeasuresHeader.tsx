import React from 'react';
import useStore from '../../store/store';

function MeasuresHeader() {
  const { seekTo } = useStore();

  const handleMeasureClick = (measure: number) => {
    // Set current beat to the start of the clicked measure (assuming 4 beats per measure)
    seekTo((measure - 1) * 4);
  };

  return (
    <div className="measures-header" style={{
      display: 'flex',
      height: '40px',
      borderBottom: '1px solid #ccc',
      backgroundColor: 'black',
      width: '3000px' // Width to accommodate all measures, minus the 200px for instruments
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i}
            onClick={() => handleMeasureClick(i + 1)}
            style={{
              position: 'absolute',
              left: `${i * 400 + 10}px`,
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'white'
            }}
          >
            {i + 1}
          </div>
        ))}
        {/* Grid lines for measures */}
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={`line-${i}`} style={{
            position: 'absolute',
            left: `${i * 100}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: i % 4 === 0 ? '#888' : '#555'
          }} />
        ))}
      </div>
    </div>
  );
}

export default MeasuresHeader; 