import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class PositionOffsetEffect extends Effect {
    constructor() {
        super();
        this.properties = new Map<string, Property<any>>([
            ['offsetX', new Property<number>('offsetX', 0, { uiType: 'slider', label: 'Offset X', min: -10, max: 10, step: 0.1 })],
            ['offsetY', new Property<number>('offsetY', 0, { uiType: 'slider', label: 'Offset Y', min: -10, max: 10, step: 0.1 })],
            ['offsetZ', new Property<number>('offsetZ', 0, { uiType: 'slider', label: 'Offset Z', min: -10, max: 10, step: 0.1 })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const offsetX = this.getPropertyValue<number>('offsetX') ?? 0;
        const offsetY = this.getPropertyValue<number>('offsetY') ?? 0;
        const offsetZ = this.getPropertyValue<number>('offsetZ') ?? 0;

        return objects.map(obj => ({
            ...obj,
            properties: {
                ...obj.properties,
                position: [
                    obj.properties.position[0] + offsetX,
                    obj.properties.position[1] + offsetY,
                    obj.properties.position[2] + offsetZ,
                ],
            },
        }));
    }

    clone(): this {
        const cloned = new PositionOffsetEffect() as this;
        this.properties.forEach((prop, name) => {
            const clonedProp = cloned.properties.get(name);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default PositionOffsetEffect; 