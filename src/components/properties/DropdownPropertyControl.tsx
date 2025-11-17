import React from 'react';
import { Property, DropdownMetadata } from '../../lib/properties/Property';

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
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '8px' }}>
        <label htmlFor={property.name} style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {metadata.label}
        </label>
      </div>
      
      <select
        id={property.name}
        name={property.name}
        value={String(property.value)}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'var(--lightSurface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          fontSize: '0.875rem',
          height: '36px',
          appearance: 'none',
          backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ddd%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px top 50%',
          backgroundSize: '10px auto',
          cursor: 'pointer'
        }}
      >
        {metadata.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      
      {metadata.description && (
        <small style={{ display: 'block', marginTop: '4px', color: '#aaa', fontSize: '0.75rem' }}>
          {metadata.description}
        </small>
      )}
    </div>
  );
}

export default DropdownPropertyControl; 