import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class PanEffect extends Effect {
    constructor() {
        super();
        this.properties = new Map<string, Property<any>>([
            ['directionX', new Property<number>('directionX', 1, { uiType: 'numberInput', label: 'Pan Direction X', min: -1, max: 1, step: 0.1 })],
            ['directionY', new Property<number>('directionY', 0, { uiType: 'numberInput', label: 'Pan Direction Y', min: -1, max: 1, step: 0.1 })],
            ['directionZ', new Property<number>('directionZ', 0, { uiType: 'numberInput', label: 'Pan Direction Z', min: -1, max: 1, step: 0.1 })],
            ['amount', new Property<number>('amount', 2, { uiType: 'slider', label: 'Pan Amount', min: 0, max: 20, step: 0.1 })],
            ['speedMultiplier', new Property<number>('speedMultiplier', 1, { uiType: 'slider', label: 'Pan Speed (x Tempo)', min: 0.1, max: 8, step: 0.1, info: "Multiplier for beat sync. 1 = 1 cycle per 4 beats." })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const dirX = this.getPropertyValue<number>('directionX') ?? 1;
        const dirY = this.getPropertyValue<number>('directionY') ?? 0;
        const dirZ = this.getPropertyValue<number>('directionZ') ?? 0;
        const amount = this.getPropertyValue<number>('amount') ?? 2;
        const speedMultiplier = this.getPropertyValue<number>('speedMultiplier') ?? 1;

        // Normalize direction vector
        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
        const normDirX = magnitude > 0 ? dirX / magnitude : 1;
        const normDirY = magnitude > 0 ? dirY / magnitude : 0;
        const normDirZ = magnitude > 0 ? dirZ / magnitude : 0;

        // Calculate pan phase based on time (beats)
        // One cycle per 4 beats when speedMultiplier is 1
        const phase = (time / 4) * speedMultiplier * 2 * Math.PI;
        const panValue = Math.sin(phase) * amount;

        const panOffsetX = normDirX * panValue;
        const panOffsetY = normDirY * panValue;
        const panOffsetZ = normDirZ * panValue;

        return objects.map(obj => ({
            ...obj,
            properties: {
                ...obj.properties,
                position: [
                    obj.properties.position[0] + panOffsetX,
                    obj.properties.position[1] + panOffsetY,
                    obj.properties.position[2] + panOffsetZ,
                ],
            },
        }));
    }

    clone(): this {
        const cloned = new PanEffect() as this;
        this.properties.forEach((prop, name) => {
            const clonedProp = cloned.properties.get(name);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default PanEffect; 