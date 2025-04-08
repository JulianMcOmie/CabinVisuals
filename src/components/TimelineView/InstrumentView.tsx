import React from 'react';

interface InstrumentViewProps {
  track: any;
}

const InstrumentView: React.FC<InstrumentViewProps> = ({ track }) => {
  return (
    <div className="instrument-view" style={{
      padding: '10px',
      height: '100%',
      borderBottom: '1px solid #ccc',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div>{track.name || 'Untitled Track'}</div>
    </div>
  );
};

export default InstrumentView; 