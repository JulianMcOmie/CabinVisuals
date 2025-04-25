import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, InstanceData, NoteContext } from '../VisualObjectEngine';

// Simple Vector Math Helpers (using tuples)
type Vec3Tuple = [number, number, number];

const vec3Add = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vec3Sub = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vec3Scale = (v: Vec3Tuple, s: number): Vec3Tuple => [v[0] * s, v[1] * s, v[2] * s];
const vec3Length = (v: Vec3Tuple): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
const vec3Normalize = (v: Vec3Tuple): Vec3Tuple => {
    const len = vec3Length(v);
    return len > 0 ? vec3Scale(v, 1 / len) : [0, 0, 0];
};
const vec3Clone = (v: Vec3Tuple): Vec3Tuple => [...v];

class SpiralGalaxySynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new SpiralGalaxySynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    // Override to add emissive properties
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);
        const glowIntensity = this.getPropertyValue<number>('glowIntensity') ?? 0.5;
        const baseColor = this.getPropertyValue<string>('baseColor') ?? '#ffffff';

        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined) {
                console.warn('SpiralGalaxySynth: Missing required base properties for glow effect', obj);
                return obj;
            }

            const effectiveOpacity = Math.max(0, obj.properties.opacity); // Clamp opacity >= 0
            const intensity = glowIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    color: baseColor,
                    emissive: baseColor,
                    emissiveIntensity: intensity
                }
            };
        });

        return processedObjects;
    }

    private initializeProperties(): void {
        this.properties.set('numSpheres', new Property<number>(
            'numSpheres', 5, { label: 'Spheres Per Layer', uiType: 'slider', min: 1, max: 20, step: 1 }
        ));
        this.properties.set('numLayers', new Property<number>(
            'numLayers', 3, { label: 'Number of Layers', uiType: 'slider', min: 1, max: 10, step: 1 }
        ));
        this.properties.set('layerSpacing', new Property<number>(
            'layerSpacing', 2.0, { label: 'Layer Spacing (Radius)', uiType: 'slider', min: 0, max: 10, step: 0.1 }
        ));
        this.properties.set('baseColor', new Property<string>(
            'baseColor', '#a0f0ff', { label: 'Color', uiType: 'color' }
        ));
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity', 0.5, { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 3, step: 0.05 }
        ));
        this.properties.set('spheresEnteringPerBeat', new Property<number>(
            'spheresEnteringPerBeat', 1.0, { label: 'Spheres Entering / Beat (+/-)', uiType: 'slider', min: -10, max: 10, step: 0.1 }
        ));
        this.properties.set('rotationSpeed', new Property<number>(
            'rotationSpeed', 0.5, { label: 'Rotation Speed (rad/sec)', uiType: 'slider', min: -5, max: 5, step: 0.05 }
        ));
        this.properties.set('spiralRadius', new Property<number>(
            'spiralRadius', 3.0, { label: 'Base Spiral Radius (XY)', uiType: 'slider', min: 0.1, max: 15, step: 0.1 }
        ));
        this.properties.set('sphereScale', new Property<number>(
            'sphereScale', 0.3, { label: 'Sphere Scale', uiType: 'slider', min: 0.05, max: 2, step: 0.01 }
        ));
        this.properties.set('nearClipZ', new Property<number>(
            'nearClipZ', -10.0, { label: 'Near Clip Plane (Z)', uiType: 'slider', min: -100, max: 50, step: 1 }
        ));
        this.properties.set('farClipZ', new Property<number>(
            'farClipZ', 50.0, { label: 'Far Clip Plane (Z)', uiType: 'slider', min: -50, max: 150, step: 1 }
        ));
    }

    private initializeEngine(): void {
        let totalInstances = 1; 

        this.engine.defineObject('sphere')
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                const numSpheres = this.getPropertyValue<number>('numSpheres') ?? 5;
                const numLayers = this.getPropertyValue<number>('numLayers') ?? 3;
                const baseRadius = this.getPropertyValue<number>('spiralRadius') ?? 3.0;
                const layerSpacing = this.getPropertyValue<number>('layerSpacing') ?? 2.0;
                const nearZ = this.getPropertyValue<number>('nearClipZ') ?? -10.0;
                const farZ = this.getPropertyValue<number>('farClipZ') ?? 50.0;
                const zRange = Math.max(1, farZ - nearZ); 

                const instances: InstanceData[] = [];
                totalInstances = numSpheres * numLayers;
                totalInstances = Math.max(1, totalInstances);

                for (let i = 0; i < totalInstances; i++) {
                    const layerIndex = Math.floor(i / numSpheres);
                    const sphereIndexInLayer = i % numSpheres;
                    const layerRadius = baseRadius + layerIndex * layerSpacing;
                    const initialAngleOffset = (sphereIndexInLayer / numSpheres) * Math.PI * 2;
                    const initialZOffsetRatio = totalInstances > 1 ? (i / (totalInstances - 1)) : 0.5;
                    const initialZ = nearZ + initialZOffsetRatio * zRange;

                    instances.push({
                        instanceId: i,
                        initialAngleOffset: initialAngleOffset,
                        layerRadius: layerRadius,
                        initialZ: initialZ 
                    });
                }
                return instances;
            })
            .withPosition((ctx: MappingContext): Vec3Tuple => {
                const { time, noteAbsoluteStartBeat, instanceData } = ctx; 
                const initialAngleOffset = instanceData?.initialAngleOffset as number ?? 0;
                const layerRadius = instanceData?.layerRadius as number ?? 3.0;
                const initialZ = instanceData?.initialZ as number ?? 0;

                const spheresEnteringPerBeat = this.getPropertyValue<number>('spheresEnteringPerBeat') ?? 1.0;
                const rotationSpeed = this.getPropertyValue<number>('rotationSpeed') ?? 0.5;
                const nearClipZ = this.getPropertyValue<number>('nearClipZ') ?? -10.0;
                const farClipZ = this.getPropertyValue<number>('farClipZ') ?? 50.0;
                
                const zRange = Math.abs(farClipZ - nearClipZ);
                if (zRange < 0.01) return [0,0,nearClipZ];

                const internalMovementUnitsPerBeat = (spheresEnteringPerBeat * zRange) / totalInstances;

                const timeSinceNoteStartBeats = time - noteAbsoluteStartBeat;
                const timeSinceNoteStartSec = timeSinceNoteStartBeats * (60 / ctx.bpm); 

                const currentAngle = initialAngleOffset + rotationSpeed * timeSinceNoteStartSec;
                const x = Math.cos(currentAngle) * layerRadius;
                const y = Math.sin(currentAngle) * layerRadius;

                const rawZ = initialZ + internalMovementUnitsPerBeat * timeSinceNoteStartBeats;

                let z = rawZ;
                if (internalMovementUnitsPerBeat > 0) {
                    z = nearClipZ + ((rawZ - nearClipZ) % zRange + zRange) % zRange; 
                } else if (internalMovementUnitsPerBeat < 0) {
                    z = farClipZ - ((farClipZ - rawZ) % zRange + zRange) % zRange;
                } 

                return [x, y, z];
            })
            .withScale((ctx: MappingContext): Vec3Tuple => {
                const scale = this.getPropertyValue<number>('sphereScale') ?? 0.3;
                return [scale, scale, scale];
            })
            .withOpacity((ctx: MappingContext): number => {
                return 1.0; 
            })
            .withColor((ctx: MappingContext): string => {
                return this.getPropertyValue<string>('baseColor') ?? '#a0f0ff';
            });
    }
}

export default SpiralGalaxySynth; 