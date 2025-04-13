import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';

class ParticleBurstSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            ['particleCountVelocityScale', new Property<number>('particleCountVelocityScale', 0.2, {
                uiType: 'slider', label: 'Particle Count/Velocity', min: 0.01, max: 1, step: 0.01
            })],
            ['burstRadius', new Property<number>('burstRadius', 3, {
                uiType: 'slider', label: 'Burst Radius', min: 0.1, max: 10, step: 0.1
            })],
            ['particleBaseSize', new Property<number>('particleBaseSize', 0.1, {
                uiType: 'slider', label: 'Particle Size', min: 0.01, max: 0.5, step: 0.01
            })],
            ['hueRange', new Property<number>('hueRange', 60, { // Degrees range based on note (0-11)
                uiType: 'slider', label: 'Hue Range/Note', min: 0, max: 180, step: 5
            })],
            ['attack', new Property<number>('attack', 0.01, { uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 1, step: 0.001 })],
            ['decay', new Property<number>('decay', 0.5, { uiType: 'slider', label: 'Decay (s)', min: 0.01, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })], // No sustain usually for bursts
            ['release', new Property<number>('release', 0.8, { uiType: 'slider', label: 'Release (s)', min: 0.01, max: 3, step: 0.01 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere') // Small, detailed shape for particles
            // Generate multiple particle instances based on velocity
            .forEachInstance((parentCtx: MappingContext) => {
                const countScale = this.getPropertyValue<number>('particleCountVelocityScale') ?? 0.2;
                const burstRadius = this.getPropertyValue<number>('burstRadius') ?? 3;
                // Use note velocity to determine particle count
                const particleCount = Math.max(1, Math.floor(parentCtx.note.velocity * countScale));
                const instances: InstanceData[] = [];

                for (let i = 0; i < particleCount; i++) {
                    // Generate a random direction vector for each particle in 3D space
                    const theta = Math.random() * 2 * Math.PI; // Random angle (0 to 2pi)
                    const phi = Math.acos(2 * Math.random() - 1); // Random angle for spherical distribution
                    
                    // Calculate direction vector (unit vector)
                    const dirX = Math.sin(phi) * Math.cos(theta);
                    const dirY = Math.sin(phi) * Math.sin(theta);
                    const dirZ = Math.cos(phi);

                    instances.push({
                        particleIndex: i,
                        direction: [dirX, dirY, dirZ],
                        totalParticles: particleCount
                    });
                }
                return instances;
            })
            .applyADSR((noteCtx: NoteContext) => ({
                attack: this.getPropertyValue<number>('attack') ?? 0.01,
                decay: this.getPropertyValue<number>('decay') ?? 0.5,
                sustain: this.getPropertyValue<number>('sustain') ?? 0, // No sustain
                release: this.getPropertyValue<number>('release') ?? 0.8,
            }))
            .withPosition((ctx: MappingContext) => {
                // Get the direction vector for this particle
                const direction = ctx.instanceData.direction as [number, number, number];
                
                // Distance from center is proportional to ADSR amplitude
                const amplitude = ctx.adsrAmplitude ?? 0;
                const burstRadius = this.getPropertyValue<number>('burstRadius') ?? 3;
                const distance = burstRadius * amplitude;
                
                // Calculate position by multiplying direction by distance
                const x = direction[0] * distance;
                const y = direction[1] * distance;
                const z = direction[2] * distance;

                return [x, y, z];
            })
            .withScale((ctx: MappingContext) => {
                const baseSize = this.getPropertyValue<number>('particleBaseSize') ?? 0.1;
                const amplitude = ctx.adsrAmplitude ?? 0;
                
                // Add slight variation based on particle index
                const variation = MUtils.mapValue(
                    ctx.instanceData.particleIndex, 
                    0, 
                    ctx.instanceData.totalParticles - 1, 
                    0.8, 
                    1.2
                );
                
                return baseSize * variation;
            })
            .withColor((ctx: MappingContext) => {
                const noteMod12 = ctx.note.pitch % 12; // 0-11
                const hueRange = this.getPropertyValue<number>('hueRange') ?? 60;
                const baseHue = MUtils.mapValue(noteMod12, 0, 11, 0, hueRange); // Note sets base hue in the range
                
                // Add slight variation per particle
                const particleHueShift = MUtils.mapValue(
                    ctx.instanceData.particleIndex, 
                    0, 
                    ctx.instanceData.totalParticles - 1, 
                    -15, 
                    15
                );
                
                const hue = (baseHue + particleHueShift + 360) % 360;
                const saturation = 90;
                const lightness = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 50, 85); // Brightness tied to ADSR

                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext) => {
                // Opacity directly proportional to ADSR amplitude
                return ctx.adsrAmplitude ?? 0;
            });
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        console.log('getObjectsAtTime: ', this.engine.getObjectsAtTime(time, midiBlocks, bpm));
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new ParticleBurstSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default ParticleBurstSynth; 