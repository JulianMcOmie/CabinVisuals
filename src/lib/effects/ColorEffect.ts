import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class ColorEffect extends Effect {
    constructor() {
        super();
        this.properties = new Map<string, Property<any>>([
            ['color', new Property<string>('color', '#ffffff', { uiType: 'color', label: 'Object Color' })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const overrideColor = this.getPropertyValue<string>('color') ?? '#ffffff';

        return objects.map(obj => ({
            ...obj,
            properties: {
                ...obj.properties,
                color: overrideColor, // Override the color property
            },
        }));
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