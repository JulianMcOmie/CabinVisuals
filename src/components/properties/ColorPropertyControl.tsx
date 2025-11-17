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
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label htmlFor={property.name} style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {property.label}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '9999px', 
              backgroundColor: property.value,
              border: '1px solid var(--border)'
            }}
          />
          <input
            type="color"
            id={property.name}
            name={property.name}
            value={property.value}
            onChange={handleChange}
            style={{ 
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: '0',
              padding: '0'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ColorPropertyControl; 