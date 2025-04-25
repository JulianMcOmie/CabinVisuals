import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, InstanceData, ADSRConfig, NoteContext, ApproachEnvelopeConfig } from '../VisualObjectEngine';

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

class ConvergingSpheresSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new ConvergingSpheresSynth() as this;
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
        const glowIntensity = this.getPropertyValue<number>('glowIntensity') ?? 1.0;
        const baseColor = this.getPropertyValue<string>('baseColor') ?? '#ffffff';

        const processedObjects = baseObjects.map(obj => {
             // Check if necessary properties exist before processing
             if (!obj.properties || obj.properties.opacity === undefined) {
                console.warn('ConvergingSpheresSynth: Missing required base properties for glow effect', obj);
                return obj;
             }

            const effectiveOpacity = Math.max(0, obj.properties.opacity); // Clamp opacity >= 0
            const intensity = glowIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    // Note: VisualObjectEngine doesn't seem to have a .withColor mapper by default
                    // Ensure color is explicitly set here or via a mapper if added later.
                    color: baseColor, 
                    emissive: baseColor, // Use base color for glow
                    emissiveIntensity: intensity    // Scale glow with opacity
                }
            };
        });

        return processedObjects;
    }

    private initializeProperties(): void {
        this.properties.set('numSpheres', new Property<number>(
            'numSpheres', 5, { label: 'Number of Spheres', uiType: 'slider', min: 1, max: 20, step: 1 }
        ));
        this.properties.set('baseColor', new Property<string>(
            'baseColor', '#00ffff', { label: 'Color', uiType: 'color' }
        ));
        this.properties.set('startDistance', new Property<number>(
            'startDistance', 15, { label: 'Start XY Distance', uiType: 'slider', min: 1, max: 50, step: 1 }
        ));
        this.properties.set('startZ', new Property<number>(
            'startZ', 20, { label: 'Start Depth (Z)', uiType: 'slider', min: -50, max: 50, step: 1 }
        ));
        this.properties.set('lookaheadTimeSeconds', new Property<number>(
            'lookaheadTimeSeconds', 0.5, { label: 'Lookahead Time (s)', uiType: 'slider', min: 0.0, max: 4, step: 0.05 }
        ));
        this.properties.set('arcIntensity', new Property<number>(
            'arcIntensity', 5.0, { label: 'Arc Intensity', uiType: 'slider', min: 0, max: 20, step: 0.1 }
        ));
        this.properties.set('postHitSlowdown', new Property<number>(
            'postHitSlowdown', 0.1, { label: 'Post-Hit Slowdown', uiType: 'slider', min: 0.01, max: 1.0, step: 0.01 }
        ));
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity', 1.5, { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }
        ));

        // ADSR
        this.properties.set('attackTime', new Property<number>(
            'attackTime', 0.01, { label: 'Attack (s)', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('decayTime', new Property<number>(
            'decayTime', 0.2, { label: 'Decay (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.01 }
        ));
        this.properties.set('sustainLevel', new Property<number>(
            'sustainLevel', 0.5, { label: 'Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('releaseTime', new Property<number>(
            'releaseTime', 0.5, { label: 'Release (s)', uiType: 'slider', min: 0.0, max: 3.0, step: 0.01 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attackTime') ?? 0.01,
            decay: this.getPropertyValue<number>('decayTime') ?? 0.2,
            sustain: this.getPropertyValue<number>('sustainLevel') ?? 0.5,
            release: this.getPropertyValue<number>('releaseTime') ?? 0.5,
        });

        const approachConfigFn = (noteCtx: NoteContext): ApproachEnvelopeConfig => ({
            lookaheadTime: this.getPropertyValue<number>('lookaheadTimeSeconds') ?? 0.5
        });

        this.engine.defineObject('sphere')
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                const numSpheres = this.getPropertyValue<number>('numSpheres') ?? 5;
                const instances: InstanceData[] = [];
                const startDistance = this.getPropertyValue<number>('startDistance') ?? 15;
                const startZ = this.getPropertyValue<number>('startZ') ?? 20;
                const arcIntensity = this.getPropertyValue<number>('arcIntensity') ?? 5.0;

                for (let i = 0; i < numSpheres; i++) {
                    const angle = (i / numSpheres) * Math.PI * 2;
                    const initialPos: Vec3Tuple = [
                        Math.cos(angle) * startDistance,
                        Math.sin(angle) * startDistance, 
                        startZ
                    ];
                    
                    const tangentDirection: Vec3Tuple = [-initialPos[1], initialPos[0], 0];
                    const initialTangent = vec3Scale(vec3Normalize(tangentDirection), arcIntensity);

                    instances.push({
                        instanceId: i, 
                        initialPosition: initialPos,
                        initialTangent: initialTangent
                    });
                }
                return instances;
            })
            .applyApproachEnvelope(approachConfigFn)
             .applyADSR(adsrConfigFn)
             .withPosition((ctx: MappingContext): Vec3Tuple => {
                const { timeSinceNoteStart, instanceData } = ctx; 
                const initialPos = instanceData?.initialPosition as Vec3Tuple | undefined;
                const initialTangent = instanceData?.initialTangent as Vec3Tuple | undefined;
                const lookaheadTime = this.getPropertyValue<number>('lookaheadTimeSeconds') ?? 0.5;
                const postHitSlowdown = this.getPropertyValue<number>('postHitSlowdown') ?? 0.1;

                if (!initialPos || !initialTangent || lookaheadTime <= 0) {
                    return timeSinceNoteStart >= 0 ? [0, 0, 0] : initialPos ?? [0,0,20]; 
                }

                const approachProgress = Math.max(0, Math.min(1, 1 + timeSinceNoteStart / lookaheadTime));

                const radialPosX = initialPos[0] * (1.0 - approachProgress);
                const radialPosY = initialPos[1] * (1.0 - approachProgress);
                const radialPosZ = initialPos[2] * (1.0 - approachProgress);
                let radialPos: Vec3Tuple = [radialPosX, radialPosY, radialPosZ];

                const tangentMagnitude = vec3Length(initialTangent);
                const tangentFactor = (1.0 - approachProgress) * (1.0 - approachProgress);
                const tangentDirNorm = vec3Normalize([initialTangent[0], initialTangent[1], 0]); 
                const tangentOffset = vec3Scale(tangentDirNorm, tangentMagnitude * tangentFactor);

                let currentPos = vec3Add(radialPos, tangentOffset);

                if (timeSinceNoteStart >= 0) {
                    const radialVelXY: Vec3Tuple = vec3Scale([initialPos[0], initialPos[1], 0], -1 / lookaheadTime);
                    const radialVelZ = initialPos[2] * (-1 / lookaheadTime);
                    
                    const impactVelocity: Vec3Tuple = [radialVelXY[0], radialVelXY[1], radialVelZ];

                    const postHitDisplacement = vec3Scale(impactVelocity, timeSinceNoteStart * postHitSlowdown);
                    
                    currentPos = postHitDisplacement; 
                }

                return currentPos;
            })
            .withScale((ctx: MappingContext): Vec3Tuple => {
                return [0.5, 0.5, 0.5];
            })
             .withColor((ctx: MappingContext): string => {
                return this.getPropertyValue<string>('baseColor') ?? '#ffffff';
             })
    }
}

export default ConvergingSpheresSynth; 