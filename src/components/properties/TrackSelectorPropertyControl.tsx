import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/store';
import { Property } from '../../lib/properties/Property';

interface Props {
    property: Property<string[]>;
    value: string[]; // Array of selected track IDs
    onChange: (value: string[]) => void;
}

// Define inline styles using CSS variables
const styles: { [key: string]: React.CSSProperties } = {
    propertyControlContainer: {
        marginBottom: '10px',
        fontFamily: 'Inter, sans-serif', // Use Inter font
        color: 'var(--text)', // Use text color variable
    },
    propertyLabel: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '13px',
        fontWeight: 500, 
        color: 'var(--accent)' // Use accent color for label
    },
    checkboxGroupContainer: {
        maxHeight: '150px',
        overflowY: 'auto' as React.CSSProperties['overflowY'],
        border: '1px solid var(--border)', // Use border variable
        padding: '10px',
        borderRadius: '4px',
        background: 'var(--surface)', // Use surface variable
    },
    checkboxItem: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px',
    },
    checkboxInput: {
        marginRight: '8px',
        cursor: 'pointer',
        accentColor: 'var(--highlight)' // Style the checkbox itself
    },
    checkboxLabel: {
        fontSize: '14px',
        cursor: 'pointer',
        color: 'var(--text)'
    },
    separator: {
        border: 'none',
        borderTop: '1px solid var(--border)',
        margin: '8px 0'
    },
    disabledLabel: {
        color: '#666', // Keep disabled color specific or use a variable if defined
        cursor: 'not-allowed'
    }
};

const TrackSelectorPropertyControl: React.FC<Props> = ({ property, value, onChange }) => {
    const { tracks } = useStore();
    const isTargetingAll = value.length === 0;

    // Memoize track options to avoid re-computation on every render
    const trackOptions = useMemo(() => 
        tracks.map(track => ({ id: track.id, name: track.name || `Track ${track.id.substring(0,4)}` }))
    , [tracks]);

    const handleAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            onChange([]); // Empty array means all tracks
        } else {
            // If unchecking 'All', select all individual tracks (or none? Let's select all)
             const allIds = trackOptions.map(t => t.id);
             onChange(allIds);
        }
    };

    const handleTrackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const trackId = event.target.value;
        const isChecked = event.target.checked;

        let newValue: string[];
        if (isChecked) {
            // Add track ID if not already present
            newValue = Array.from(new Set([...value, trackId]));
        } else {
            // Remove track ID
            newValue = value.filter(id => id !== trackId);
        }
        onChange(newValue);
    };

    return (
        <div style={styles.propertyControlContainer}>
            <label style={styles.propertyLabel}>{property.metadata.label || property.name}</label>
            <div style={styles.checkboxGroupContainer}>
                 {/* "All Tracks" Checkbox */}
                <div style={styles.checkboxItem}>
                    <input
                        type="checkbox"
                        id={`${property.name}-all`}
                        checked={isTargetingAll}
                        onChange={handleAllChange}
                        style={styles.checkboxInput}
                    />
                    <label htmlFor={`${property.name}-all`} style={styles.checkboxLabel}>_All Tracks_</label>
                </div>

                <hr style={styles.separator} /> 

                {/* Individual Track Checkboxes */}
                {trackOptions.map(track => (
                    <div key={track.id} style={styles.checkboxItem}>
                        <input
                            type="checkbox"
                            id={`${property.name}-${track.id}`}
                            value={track.id}
                            checked={!isTargetingAll && value.includes(track.id)} // Checked if not targeting all AND included
                            onChange={handleTrackChange}
                            disabled={isTargetingAll} // Disable if "All" is checked
                            style={styles.checkboxInput}
                        />
                        <label 
                            htmlFor={`${property.name}-${track.id}`} 
                            style={{
                                ...styles.checkboxLabel, 
                                ...(isTargetingAll ? styles.disabledLabel : {})
                            }} // Conditionally apply disabled style
                        >
                            {track.name}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TrackSelectorPropertyControl; 