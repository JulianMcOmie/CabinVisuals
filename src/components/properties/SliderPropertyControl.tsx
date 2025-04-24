import React from 'react';
import { Property, NumericMetadata } from '../../lib/properties/Property';

// Define colors matching page.tsx
const COLORS = {
  accent: "#5a8ea3", // Subtle blue-gray
  highlight: "#c8a45b", // Muted gold/amber
  green: "#6a9955", // Muted green
  background: "#1e1e1e", // Dark background
  surface: "#252525", // Slightly lighter surface
  border: "#3a3a3a", // Border color
  activeBg: "#2d3540", // Active element background
  electricBlue: "#00c3ff", // Vibrant electric blue accent
};

interface SliderPropertyControlProps {
  property: Property<number>;
  onChange: (value: number) => void;
}

function SliderPropertyControl({ property, onChange }: SliderPropertyControlProps) {
  // Type assertion is safe here because parent component checks uiType
  const metadata = property.metadata as NumericMetadata;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(event.target.value));
  };

  // Get percentage value for display
  const percentage = ((property.value - metadata.min) / (metadata.max - metadata.min)) * 100;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <label htmlFor={property.name} style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {metadata.label}
        </label>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      
      <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
        {/* Track background */}
        <div style={{ 
          position: 'absolute', 
          inset: '0px',
          height: '4px', 
          backgroundColor: '#3a3a3a',
          borderRadius: '9999px', 
          top: '50%', 
          transform: 'translateY(-50%)'
        }}></div>
        
        {/* Colored progress */}
        <div style={{ 
          position: 'absolute', 
          height: '4px',
          width: `${percentage}%`, 
          backgroundColor: COLORS.accent,
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
          left: `calc(${percentage}% - 8px)`,
          backgroundColor: COLORS.accent,
          borderColor: '#ddd',
          borderWidth: '2px',
          borderRadius: '9999px',
          cursor: 'grab'
        }}></div>
        
        {/* Actual range input (invisible but functional) */}
        <input
          type="range"
          id={property.name}
          name={property.name}
          min={metadata.min}
          max={metadata.max}
          step={metadata.step}
          value={property.value}
          onChange={handleChange}
          style={{ 
            position: 'absolute',
            inset: '0px',
            opacity: 0,
            width: '100%',
            cursor: 'pointer'
          }}
        />
      </div>
      
      {metadata.description && (
        <small style={{ display: 'block', marginTop: '2px', color: '#aaa', fontSize: '0.75rem' }}>
          {metadata.description}
        </small>
      )}
    </div>
  );
}

export default SliderPropertyControl; 