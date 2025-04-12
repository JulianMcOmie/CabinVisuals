import React from 'react';
import { Property, DropdownMetadata, DropdownOption } from '../../lib/properties/Property';

interface DropdownPropertyControlProps<T> {
  property: Property<T>;
  onChange: (value: T) => void;
}

function DropdownPropertyControl<T>({ property, onChange }: DropdownPropertyControlProps<T>) {
  const metadata = property.metadata as DropdownMetadata<T>; // Safe assertion

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValueString = event.target.value;
    // Find the original option to get the correctly typed value
    const selectedOption = metadata.options.find(
      option => String(option.value) === selectedValueString
    );
    if (selectedOption) {
      onChange(selectedOption.value);
    }
  };

  return (
    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
      <label htmlFor={property.name} style={{ marginRight: '10px', minWidth: '120px' }}>
        {metadata.label}:
      </label>
      <select
        id={property.name}
        name={property.name}
        value={String(property.value)} // Select value must be a string
        onChange={handleChange}
        style={{
          padding: '5px',
          backgroundColor: '#333',
          color: '#ddd',
          border: '1px solid #555',
          minWidth: '100px'
        }}
      >
        {metadata.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {metadata.description && <small style={{ marginLeft: '10px', color: '#aaa' }}>{metadata.description}</small>}
    </div>
  );
}

export default DropdownPropertyControl; 