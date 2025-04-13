import React from 'react';
import { Property, NumericMetadata } from '../../lib/properties/Property';

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
    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
      <label htmlFor={property.name} style={{ marginRight: '10px', minWidth: '120px' }}>
        {metadata.label}:
      </label>
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
          padding: '5px',
          backgroundColor: '#333',
          color: '#ddd',
          border: '1px solid #555',
          width: '80px'
        }}
      />
       {metadata.description && <small style={{ marginLeft: '10px', color: '#aaa' }}>{metadata.description}</small>}
    </div>
  );
}

export default NumberInputPropertyControl; 