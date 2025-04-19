import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class RescalePositionEffect extends Effect {
    constructor() {
        super();
        this.properties = new Map<string, Property<any>>([
            ['scaleX', new Property<number>('scaleX', 1, { uiType: 'slider', label: 'Scale X', min: 0, max: 5, step: 0.05 })],
            ['scaleY', new Property<number>('scaleY', 1, { uiType: 'slider', label: 'Scale Y', min: 0, max: 5, step: 0.05 })],
            ['scaleZ', new Property<number>('scaleZ', 1, { uiType: 'slider', label: 'Scale Z', min: 0, max: 5, step: 0.05 })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const scaleX = this.getPropertyValue<number>('scaleX') ?? 1;
        const scaleY = this.getPropertyValue<number>('scaleY') ?? 1;
        const scaleZ = this.getPropertyValue<number>('scaleZ') ?? 1;

        return objects.map(obj => ({
            ...obj,
            properties: {
                ...obj.properties,
                position: [
                    obj.properties.position[0] * scaleX,
                    obj.properties.position[1] * scaleY,
                    obj.properties.position[2] * scaleZ,
                ],
            },
        }));
    }

    clone(): this {
        const cloned = new RescalePositionEffect() as this;
        this.properties.forEach((prop, name) => {
            const clonedProp = cloned.properties.get(name);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default RescalePositionEffect; 