import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote, VisualObjectProperties } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData, ADSRConfigFn } from '../VisualObjectEngine';
import * as THREE from 'three';

// Helper function to generate points on a sphere using Fibonacci lattice
function generateFibonacciSpherePoints(samples: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle in radians

    for (let i = 0; i < samples; i++) {
        const y = 1 - (i / (samples - 1)) * 2; // y goes from 1 to -1
        const radius = Math.sqrt(1 - y * y); // radius at y

        const theta = phi * i; // Golden angle increment

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        points.push(new THREE.Vector3(x, y, z));
    }
    return points;
}

class SymmetricResonanceSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    protected initializeProperties(): void {
        // Using Property with correct metadata structure
        this.properties.set('minRadius', new Property<number>('minRadius', 1, { label: 'Min Radius', uiType: 'slider', min: 0.1, max: 5, step: 0.1 }));
        this.properties.set('maxRadius', new Property<number>('maxRadius', 3, { label: 'Max Radius', uiType: 'slider', min: 1, max: 30, step: 0.5 }));
        this.properties.set('expansionRate', new Property<number>('expansionRate', 0.5, { label: 'Expansion Rate', uiType: 'slider', min: 0, max: 5, step: 0.1 }));
        this.properties.set('minParticles', new Property<number>('minParticles', 10, { label: 'Min Particles', uiType: 'slider', min: 1, max: 50, step: 1 }));
        this.properties.set('maxParticles', new Property<number>('maxParticles', 50, { label: 'Max Particles', uiType: 'slider', min: 50, max: 200, step: 5 }));
        this.properties.set('particleSize', new Property<number>('particleSize', 0.5, { label: 'Particle Size', uiType: 'slider', min: 0.01, max: 0.5, step: 0.01 }));
        this.properties.set('baseSaturation', new Property<number>('baseSaturation', 80, { label: 'Saturation', uiType: 'slider', min: 0, max: 100, step: 1 }));
        this.properties.set('baseLightness', new Property<number>('baseLightness', 60, { label: 'Lightness', uiType: 'slider', min: 0, max: 100, step: 1 }));
        this.properties.set('velocityLightnessFactor', new Property<number>('velocityLightnessFactor', 15, { label: 'Velocity -> Lightness', uiType: 'slider', min: 0, max: 40, step: 1 }));
        this.properties.set('adsrRelease', new Property<number>('adsrRelease', 0.5, { label: 'ADSR Release (s)', uiType: 'slider', min: 0.1, max: 3, step: 0.1 }));
        this.properties.set('emissiveIntensity', new Property<number>('emissiveIntensity', 1.5, { label: 'Glow Intensity', uiType: 'slider', min: 0, max: 5, step: 0.1 }));
        // Placeholder for track targeting - needs implementation based on how track info is accessed
        // this.properties.set('targetTrackName', new Property<string>('targetTrackName', '', { label: 'Target Track', uiType: 'text' }));
    }

    protected initializeEngine(): void {
        const adsrConfigFn: ADSRConfigFn = (noteCtx: NoteContext) => {
            const releaseTime = this.getPropertyValue<number>('adsrRelease') ?? 0.5;
            const sustainLevel = MappingUtils.mapValue(noteCtx.note.velocity, 0, 127, 0.1, 0.8); // Velocity affects sustain
            return { attack: 0.05, decay: 0.1, sustain: sustainLevel, release: releaseTime };
        };

        this.engine.defineObject('sphere') // Define a base sphere object, though it won't be rendered itself
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                const minParticles = this.getPropertyValue<number>('minParticles') ?? 10;
                const maxParticles = this.getPropertyValue<number>('maxParticles') ?? 50;
                const particleCount = Math.floor(MappingUtils.mapValue(parentCtx.note.velocity, 0, 127, minParticles, maxParticles));
                
                const particleVectors = generateFibonacciSpherePoints(particleCount);
                
                const minRadius = this.getPropertyValue<number>('minRadius') ?? 1;
                const maxRadius = this.getPropertyValue<number>('maxRadius') ?? 10;
                // Invert mapping: higher pitch -> smaller radius
                const baseRadius = MappingUtils.mapValue(parentCtx.note.pitch, 0, 127, maxRadius, minRadius);

                // Generate instance data for each particle
                return particleVectors.map((vec, index) => ({
                    id: `p_${parentCtx.note.id}_${index}`,
                    direction: vec, // Unit vector for direction
                    initialRadius: baseRadius,
                    // Store necessary parent context info needed for later processing
                    notePitch: parentCtx.note.pitch,
                    noteVelocity: parentCtx.note.velocity,
                }));
            })
            .setType('sphere') 
            .applyADSR(adsrConfigFn) // Apply ADSR to each particle
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const direction = ctx.instanceData.direction as THREE.Vector3;
                const baseRadius = ctx.instanceData.initialRadius as number;
                const expansionRate = this.getPropertyValue<number>('expansionRate') ?? 0.5;
                const distance = baseRadius + expansionRate * ctx.timeSinceNoteStart;
                const pos = direction.clone().multiplyScalar(distance);
                return [pos.x, pos.y, pos.z];
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const size = this.getPropertyValue<number>('particleSize') ?? 0.05;
                const finalSize = size * (ctx.adsrAmplitude !== undefined ? Math.max(0.1, ctx.adsrAmplitude) : 1);
                return [finalSize, finalSize, finalSize];
            })
            .withColor((ctx: MappingContext): string => {
                const saturation = this.getPropertyValue<number>('baseSaturation') ?? 80;
                const baseLightness = this.getPropertyValue<number>('baseLightness') ?? 60;
                const velLightnessFactor = this.getPropertyValue<number>('velocityLightnessFactor') ?? 15;
                const lightness = baseLightness + MappingUtils.mapValue(ctx.instanceData.noteVelocity, 0, 127, -velLightnessFactor, velLightnessFactor); // Use velocity from instanceData
                const finalLightness = Math.max(50, lightness); 
                return MappingUtils.mapPitchToHSL(ctx.instanceData.notePitch, saturation, finalLightness); // Use pitch from instanceData
            })
            .withOpacity((ctx: MappingContext): number => {
                return ctx.adsrAmplitude ?? 0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // Get the base objects from the engine
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

        // Post-process to add emissive properties
        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined) {
                return obj; // Skip if essential properties are missing
            }

            const baseIntensity = this.getPropertyValue<number>('emissiveIntensity') ?? 1.5;
            // We need velocity associated with the object. 
            // The engine context isn't directly available here.
            // We need to ensure sourceNoteId is reliably passed and maybe retrieve the note velocity
            // For now, let's use a simpler intensity calculation based on opacity (ADSR amplitude)
            const intensity = baseIntensity * obj.properties.opacity; // Directly use calculated opacity

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, // Use the calculated color
                    emissiveIntensity: intensity > 0.1 ? intensity : 0
                }
            };
        });

        return processedObjects;
    }

    clone(): this {
        const newInstance = new (this.constructor as any)();
        this.properties.forEach((value, key) => {
            newInstance.setPropertyValue(key, value.value);
        });
        return newInstance;
    }
}

export default SymmetricResonanceSynth; 