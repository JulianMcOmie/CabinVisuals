import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

// Helper function to parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
}

// Helper function to interpolate between two RGB colors
function interpolateRgb(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }, factor: number): string {
    const r = Math.round(color1.r + (color2.r - color1.r) * factor);
    const g = Math.round(color1.g + (color2.g - color1.g) * factor);
    const b = Math.round(color1.b + (color2.b - color1.b) * factor);
    // Clamp values just in case factor goes slightly out of bounds
    const clamp = (val: number) => Math.max(0, Math.min(255, val));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

class ColorEffect extends Effect {
    constructor() {
        super();
        this.properties = new Map<string, Property<any>>([
            ['colorStart', new Property<string>('colorStart', '#ff0000', { uiType: 'color', label: 'Start Color (Min Y)' })],
            ['colorEnd', new Property<string>('colorEnd', '#0000ff', { uiType: 'color', label: 'End Color (Max Y)' })],
            ['minY', new Property<number>('minY', 0, { uiType: 'slider', label: 'Min Y Range', min: -20, max: 20, step: 0.1 })],
            ['maxY', new Property<number>('maxY', 10, { uiType: 'slider', label: 'Max Y Range', min: -20, max: 20, step: 0.1 })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const colorStartHex = this.getPropertyValue<string>('colorStart') ?? '#ff0000';
        const colorEndHex = this.getPropertyValue<string>('colorEnd') ?? '#0000ff';
        const minY = this.getPropertyValue<number>('minY') ?? 0;
        const maxY = this.getPropertyValue<number>('maxY') ?? 10;

        const colorStartRgb = hexToRgb(colorStartHex);
        const colorEndRgb = hexToRgb(colorEndHex);

        if (!colorStartRgb || !colorEndRgb) {
            console.warn('Invalid start or end color format for ColorEffect');
            return objects; // Return unchanged objects if colors are invalid
        }

        const yRange = Math.max(0.001, maxY - minY); // Avoid division by zero

        return objects.map(obj => {
            const yPos = obj.properties.position[1]; // Get Y position

            // Calculate interpolation factor (clamped between 0 and 1)
            const factor = Math.max(0, Math.min(1, (yPos - minY) / yRange));

            // Interpolate color
            const interpolatedColor = interpolateRgb(colorStartRgb, colorEndRgb, factor);

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    color: interpolatedColor, // Set the calculated color
                },
            };
        });
    }

    clone(): this {
        const cloned = new ColorEffect() as this;
        this.properties.forEach((prop, name) => {
            const clonedProp = cloned.properties.get(name);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default ColorEffect; 