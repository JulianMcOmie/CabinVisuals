import React from 'react';
import { Property } from '../../lib/properties/Property';

interface ColorPropertyControlProps {
  property: Property<string>;
  onChange: (value: string) => void;
}

function ColorPropertyControl({ property, onChange }: ColorPropertyControlProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
      <label htmlFor={property.name} style={{ marginRight: '10px', minWidth: '120px' }}>{property.label}:</label>
      <input
        type="color"
        id={property.name}
        name={property.name}
        value={property.value}
        onChange={handleChange}
        style={{ 
          padding: '2px', // Smaller padding for color input
          border: '1px solid #555',
          backgroundColor: '#333', // Match other inputs
          cursor: 'pointer', // Indicate interactivity
          height: '30px', // Consistent height
          width: '50px' // Reasonable width for color swatch
        }}
      />
      {/* Optional: Display hex value next to picker */} 
      {/* <span style={{ marginLeft: '10px', fontFamily: 'monospace', color: '#aaa' }}>{property.value}</span> */}
    </div>
  );
}

export default ColorPropertyControl; 