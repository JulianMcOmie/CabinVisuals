import React, { useState } from 'react';
import { Property, NumericMetadata } from '../../lib/properties/Property';

interface SliderPropertyControlProps {
  property: Property<number>;
  onChange: (value: number) => void;
}

function SliderPropertyControl({ property, onChange }: SliderPropertyControlProps) {
  // Type assertion is safe here because parent component checks uiType
  const metadata = property.metadata as NumericMetadata;

  // Use local state for the slider value
  const [localValue, setLocalValue] = useState<number>(property.value);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    setLocalValue(newValue); // Update local state immediately for smooth UI
    onChange(newValue); // Call the (debounced) onChange prop to update the store
  };

  // Get percentage value for display using localValue
  const percentage = ((localValue - metadata.min) / (metadata.max - metadata.min)) * 100;

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
      
      <div 
        style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
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
          width: `${percentage}%`, 
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
          left: `calc(${percentage}% - 8px)`,
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--text)',
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
          value={localValue}
          onChange={handleChange}
          onPointerDown={(e) => e.stopPropagation()}
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