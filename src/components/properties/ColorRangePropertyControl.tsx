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

    return (
        <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    {property.metadata.label || property.name}
                </label>
            </div>
            
            {/* Hue bar visualization */}
            <div 
                style={{
                    width: '100%',
                    height: '15px',
                    borderRadius: '3px',
                    background: 'linear-gradient(to right, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))',
                    marginBottom: '12px',
                }}
            ></div>
            
            {/* Start hue slider */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#aaa' }}>Start Hue</label>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{startHue}°</span>
                </div>
                <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
                    {/* Track background */}
                    <div style={{ 
                        position: 'absolute', 
                        inset: '0px',
                        height: '4px', 
                        backgroundColor: 'var(--border)',
                        borderRadius: '9999px', 
                        top: '50%', 
                        transform: 'translateY(-50%)'
                    }}></div>
                    
                    {/* Colored progress */}
                    <div style={{ 
                        position: 'absolute', 
                        height: '4px',
                        width: `${(startHue / 360) * 100}%`, 
                        backgroundColor: 'var(--accent)',
                        borderRadius: '9999px', 
                        top: '50%', 
                        transform: 'translateY(-50%)'
                    }}></div>
                    
                    {/* Draggable handle */}
                    <div style={{ 
                        position: 'absolute',
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        width: '16px', 
                        height: '16px', 
                        left: `calc(${(startHue / 360) * 100}% - 8px)`,
                        backgroundColor: 'var(--accent)',
                        borderColor: 'var(--text)',
                        borderWidth: '2px',
                        borderRadius: '9999px',
                        cursor: 'grab'
                    }}></div>
                    
                    {/* Actual range input (invisible but functional) */}
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={startHue}
                        onChange={handleStartChange}
                        style={{ 
                            position: 'absolute',
                            inset: '0px',
                            opacity: 0,
                            width: '100%',
                            cursor: 'pointer'
                        }}
                    />
                </div>
            </div>
            
            {/* End hue slider */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#aaa' }}>End Hue</label>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{endHue}°</span>
                </div>
                <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
                    {/* Track background */}
                    <div style={{ 
                        position: 'absolute', 
                        inset: '0px',
                        height: '4px', 
                        backgroundColor: 'var(--border)',
                        borderRadius: '9999px', 
                        top: '50%', 
                        transform: 'translateY(-50%)'
                    }}></div>
                    
                    {/* Colored progress */}
                    <div style={{ 
                        position: 'absolute', 
                        height: '4px',
                        width: `${(endHue / 360) * 100}%`, 
                        backgroundColor: 'var(--accent)',
                        borderRadius: '9999px', 
                        top: '50%', 
                        transform: 'translateY(-50%)'
                    }}></div>
                    
                    {/* Draggable handle */}
                    <div style={{ 
                        position: 'absolute',
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        width: '16px', 
                        height: '16px', 
                        left: `calc(${(endHue / 360) * 100}% - 8px)`,
                        backgroundColor: 'var(--accent)',
                        borderColor: 'var(--text)',
                        borderWidth: '2px',
                        borderRadius: '9999px',
                        cursor: 'grab'
                    }}></div>
                    
                    {/* Actual range input (invisible but functional) */}
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={endHue}
                        onChange={handleEndChange}
                        style={{ 
                            position: 'absolute',
                            inset: '0px',
                            opacity: 0,
                            width: '100%',
                            cursor: 'pointer'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ColorRangePropertyControl; 