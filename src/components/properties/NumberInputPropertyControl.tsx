import React from 'react';
import { Property, NumericMetadata } from '../../lib/properties/Property';

// Define colors matching page.tsx
const COLORS = {
  accent: "#5a8ea3", // Subtle blue-gray
  background: "#1e1e1e", // Dark background
  surface: "#252525", // Slightly lighter surface
  border: "#3a3a3a", // Border color
};

interface NumberInputPropertyControlProps {
  property: Property<number>;
  onChange: (value: number) => void;
}

function NumberInputPropertyControl({ property, onChange }: NumberInputPropertyControlProps) {
  const metadata = property.metadata as NumericMetadata;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseFloat(event.target.value);
    // Basic clamping - could add more validation
    if (!isNaN(value)) {
      value = Math.max(metadata.min, Math.min(metadata.max, value));
      onChange(value);
    }
  };

  // Prevent wheel scroll from changing value
  const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur(); 
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label htmlFor={property.name} style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {metadata.label}
        </label>
      </div>
      
      <input
        type="number"
        id={property.name}
        name={property.name}
        min={metadata.min}
        max={metadata.max}
        step={metadata.step}
        value={property.value}
        onChange={handleChange}
        onWheel={handleWheel} // Prevent scroll changes
        style={{
          padding: '5px 10px',
          backgroundColor: '#333',
          color: '#ddd',
          border: '1px solid #555',
          borderRadius: '4px',
          width: '100%',
          fontSize: '0.875rem',
          height: '36px'
        }}
      />
      
      {metadata.description && (
        <small style={{ display: 'block', marginTop: '4px', color: '#aaa', fontSize: '0.75rem' }}>
          {metadata.description}
        </small>
      )}
    </div>
  );
}

export default NumberInputPropertyControl; 