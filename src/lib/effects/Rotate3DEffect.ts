import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class Rotate3DEffect extends Effect {
    constructor(id: string) {
        super(id);
        this.properties = new Map<string, Property<any>>([
            ['rotationX', new Property<number>('rotationX', 0, { uiType: 'slider', label: 'Rotation X (°)', min: -360, max: 360, step: 1 })],
            ['rotationY', new Property<number>('rotationY', 0, { uiType: 'slider', label: 'Rotation Y (°)', min: -360, max: 360, step: 1 })],
            ['rotationZ', new Property<number>('rotationZ', 0, { uiType: 'slider', label: 'Rotation Z (°)', min: -360, max: 360, step: 1 })],
        ]);
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const rotXDeg = this.getPropertyValue<number>('rotationX') ?? 0;
        const rotYDeg = this.getPropertyValue<number>('rotationY') ?? 0;
        const rotZDeg = this.getPropertyValue<number>('rotationZ') ?? 0;

        // Convert degrees to radians
        const rotXRad = rotXDeg * (Math.PI / 180);
        const rotYRad = rotYDeg * (Math.PI / 180);
        const rotZRad = rotZDeg * (Math.PI / 180);

        // Precompute sin/cos
        const cosX = Math.cos(rotXRad);
        const sinX = Math.sin(rotXRad);
        const cosY = Math.cos(rotYRad);
        const sinY = Math.sin(rotYRad);
        const cosZ = Math.cos(rotZRad);
        const sinZ = Math.sin(rotZRad);

        // Rotation matrix (combined X, Y, Z - order YXZ may be common)
        // Using YXZ order for demonstration
        // Row 1
        const m11 = cosY * cosZ + sinY * sinX * sinZ;
        const m12 = -cosY * sinZ + sinY * sinX * cosZ;
        const m13 = sinY * cosX;
        // Row 2
        const m21 = cosX * sinZ;
        const m22 = cosX * cosZ;
        const m23 = -sinX;
        // Row 3
        const m31 = -sinY * cosZ + cosY * sinX * sinZ;
        const m32 = sinY * sinZ + cosY * sinX * cosZ;
        const m33 = cosY * cosX;

        return objects.map(obj => {
            const [x, y, z] = obj.properties.position ?? [0, 0, 0];

            // Apply rotation matrix
            const rotatedX = m11 * x + m12 * y + m13 * z;
            const rotatedY = m21 * x + m22 * y + m23 * z;
            const rotatedZ = m31 * x + m32 * y + m33 * z;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    position: [rotatedX, rotatedY, rotatedZ],
                    // Optionally, rotate the object's internal rotation as well if needed
                    // rotation: ... apply rotation to obj.properties.rotation ...
                },
            };
        });
    }

    clone(): this {
        const newInstance = new Rotate3DEffect(this.id) as this;
        this.properties.forEach((prop, name) => {
            const clonedProp = newInstance.properties.get(name);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return newInstance;
    }
}

export default Rotate3DEffect; 