import React, { useState, useEffect } from 'react';
import { Property } from '../../lib/properties/Property';
import { ColorRange } from '../../lib/types';

interface Props {
    property: Property<ColorRange>;
    onChange: (value: ColorRange) => void;
}

const ColorRangePropertyControl: React.FC<Props> = ({ property, onChange }) => {
    // Derive initial state from property.value
    const initialStartHue = property.value?.startHue ?? 0;
    const initialEndHue = property.value?.endHue ?? 120;

    // Use local state to manage potentially intermediate slider values
    const [startHue, setStartHue] = useState<number>(initialStartHue);
    const [endHue, setEndHue] = useState<number>(initialEndHue);

    // Update local state if the property object itself changes (e.g., synth change)
    useEffect(() => {
        setStartHue(property.value?.startHue ?? 0);
        setEndHue(property.value?.endHue ?? 120);
    }, [property]); // Depend on the whole property object

    const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newStartHue = Number(event.target.value);
        setStartHue(newStartHue);
        onChange({ startHue: newStartHue, endHue });
    };

    const handleEndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newEndHue = Number(event.target.value);
        setEndHue(newEndHue);
        onChange({ startHue, endHue: newEndHue });
    };

    // Basic CSS for the hue bar
    const hueBarStyle: React.CSSProperties = {
        width: '100%',
        height: '15px',
        borderRadius: '3px',
        background: 'linear-gradient(to right, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))',
        marginBottom: '5px',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '5px',
        fontSize: '0.9em',
        color: '#ccc', // Style as needed
    };

    const rangeInputStyle: React.CSSProperties = {
        width: '100%',
        marginBottom: '5px',
    };

    return (
        <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>{property.metadata.label || property.name}</label>
            <div style={hueBarStyle}></div>
            <input
                type="range"
                min="0"
                max="360"
                value={startHue}
                onChange={handleStartChange}
                style={rangeInputStyle}
                title={`Start Hue: ${startHue}`}
            />
            <input
                type="range"
                min="0"
                max="360"
                value={endHue}
                onChange={handleEndChange}
                style={rangeInputStyle}
                title={`End Hue: ${endHue}`}
            />
            {/* Optional: Display numerical values */}
            {/* <div style={{ fontSize: '0.8em', color: '#aaa' }}>{`Range: ${startHue}° - ${endHue}°`}</div> */}
        </div>
    );
};

export default ColorRangePropertyControl; 