import React from 'react';
import { Property, NumericMetadata } from '../../lib/properties/Property';

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

  return (
    <div style={{ marginBottom: '10px' }}>
      <label htmlFor={property.name} style={{ marginRight: '10px', display: 'block', marginBottom: '3px' }}>
        {metadata.label}: {property.value.toFixed(metadata.step < 0.01 ? 3 : 2)}
      </label>
      <input
        type="range"
        id={property.name}
        name={property.name}
        min={metadata.min}
        max={metadata.max}
        step={metadata.step}
        value={property.value}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
      {metadata.description && <small style={{ display: 'block', marginTop: '2px', color: '#aaa' }}>{metadata.description}</small>}
    </div>
  );
}

export default SliderPropertyControl; 