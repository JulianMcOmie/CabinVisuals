import React from 'react';
import { Track } from '../../lib/types';
import InstrumentView from './InstrumentView';

interface InstrumentsViewProps {
  tracks: Track[];
  effectiveTrackHeight: number;
}

function InstrumentsView({ tracks, effectiveTrackHeight }: InstrumentsViewProps) {
  return (
    <>
      {/* Map over tracks to render InstrumentView */}
      {tracks.map(track => (
        <div
          key={`${track.id}-instrument`} // Unique key
          style={{
            height: `${effectiveTrackHeight}px`, // Use effective track height
            borderBottom: '1px solid #333', // Add border between instruments
            boxSizing: 'border-box'
          }}
        >
          <InstrumentView
            track={track}
            // Pass verticalZoom if needed, or let it use effectiveTrackHeight for layout
          />
        </div>
      ))}
    </>
  );
}

export default InstrumentsView; 