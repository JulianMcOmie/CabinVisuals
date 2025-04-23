import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

/**
 * An effect that rescales the positions of visual objects relative to a center point.
 */
class RescalePositionEffect extends Effect {
    constructor(id: string) {
        super(id);
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
                    (obj.properties.position?.[0] ?? 0) * scaleX,
                    (obj.properties.position?.[1] ?? 0) * scaleY,
                    (obj.properties.position?.[2] ?? 0) * scaleZ,
                ],
            },
        }));
    }

    /**
     * Creates a clone of the RescalePositionEffect instance.
     */
    clone(): this {
        const newInstance = new RescalePositionEffect(this.id) as this;
        this.properties.forEach((prop, key) => {
            const clonedProp = newInstance.properties.get(key);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return newInstance;
    }
}

export default RescalePositionEffect; 