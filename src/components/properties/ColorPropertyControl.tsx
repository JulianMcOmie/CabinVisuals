import React from 'react';
import { Property } from '../../lib/properties/Property';

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
              border: '1px solid #555'
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