import Effect from '../Effect';
import { VisualObject, VisualObjectProperties } from '../types';
import { Property } from '../properties/Property';
import * as THREE from 'three';

class GlobalRotateEffect extends Effect {

    constructor(id: string) {
        super(id);
        this.initializeProperties();
    }

    protected initializeProperties(): void {
        // Axis properties (using sliders for now)
        this.properties.set('axisX', new Property<number>('axisX', 0, { label: 'Axis X', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        this.properties.set('axisY', new Property<number>('axisY', 1, { label: 'Axis Y', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        this.properties.set('axisZ', new Property<number>('axisZ', 0, { label: 'Axis Z', uiType: 'slider', min: -1, max: 1, step: 0.1 }));
        // Speed factor property
        this.properties.set('speedFactor', new Property<number>('speedFactor', 0.1, { label: 'Speed Factor (rotations/beat)', uiType: 'slider', min: -2, max: 2, step: 0.05 }));
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const axisX = this.getPropertyValue<number>('axisX') ?? 0;
        const axisY = this.getPropertyValue<number>('axisY') ?? 1;
        const axisZ = this.getPropertyValue<number>('axisZ') ?? 0;
        const speedFactor = this.getPropertyValue<number>('speedFactor') ?? 0;

        if (speedFactor === 0) {
            return objects; // No rotation needed
        }

        const axis = new THREE.Vector3(axisX, axisY, axisZ).normalize();
        // Ensure axis is valid (not zero vector)
        if (axis.lengthSq() === 0) {
             console.warn('GlobalRotateEffect: Invalid rotation axis [0, 0, 0]');
             return objects;
        }

        // Calculate total rotation angle in radians based on time (beats) and speed factor
        const angle = speedFactor * 2 * Math.PI * time;

        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis, angle);

        return objects.map(obj => {
            if (!obj.properties?.position) {
                return obj; // Skip objects without position
            }

            const currentPosition = new THREE.Vector3(...obj.properties.position);
            const rotatedPosition = currentPosition.applyQuaternion(quaternion);

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    position: [rotatedPosition.x, rotatedPosition.y, rotatedPosition.z]
                }
            };
        });
    }

    clone(): this {
        const newInstance = new (this.constructor as any)(this.id);
        this.properties.forEach((value, key) => {
            newInstance.setPropertyValue(key, value.value);
        });
        return newInstance;
    }
}

export default GlobalRotateEffect; 