import { Track, ColorRange } from "../types";

export type UIType = 'slider' | 'numberInput' | 'dropdown' | 'color' | 'colorRange';

// --- Metadata Interfaces ---

export interface BaseMetadata {
  label: string;
  description?: string; // Optional description for tooltips etc.
}

export interface NumericMetadata extends BaseMetadata {
  min: number;
  max: number;
  step: number;
}

export interface DropdownOption<T> {
  value: T;
  label: string;
}

export interface DropdownMetadata<T> extends BaseMetadata {
  options: DropdownOption<T>[];
}

// Add metadata specific to color type (can just be BaseMetadata for now)
export interface ColorMetadata extends BaseMetadata {}

// Add metadata specific to colorRange type
export interface ColorRangeMetadata extends BaseMetadata {}

// --- Union Type for Metadata based on UIType ---

export type PropertyMetadata<T> =
  | (NumericMetadata & { uiType: 'slider' | 'numberInput' })
  | (DropdownMetadata<T> & { uiType: 'dropdown' })
  | (ColorMetadata & { uiType: 'color' })
  | (ColorRangeMetadata & { uiType: 'colorRange' });

// --- Property Class ---

export class Property<T> {
  public readonly name: string;
  public readonly metadata: PropertyMetadata<T>;
  public value: T;
  public readonly defaultValue: T;

  constructor(
    name: string,
    defaultValue: T,
    metadata: PropertyMetadata<T>
  ) {
    this.name = name;
    this.defaultValue = defaultValue;
    this.value = defaultValue; // Initialize with default value
    this.metadata = metadata;
  }

  // Helper to get the UI type easily
  get uiType(): UIType {
    return this.metadata.uiType;
  }
  
  // Helper to get the label easily
  get label(): string {
	return this.metadata.label;
  }

  // Method to reset to default value
  reset(): void {
    this.value = this.defaultValue;
  }
  
  // Simple clone method for immutability
  clone(): Property<T> {
    const cloned = new Property<T>(this.name, this.defaultValue, this.metadata);
    cloned.value = this.value; // Copy current value
    return cloned;
  }
}