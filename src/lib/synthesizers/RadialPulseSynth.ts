import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, ADSRConfig } from '../VisualObjectEngine';

class RadialPulseSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            // Center Sphere
            ['centerSize', new Property<number>('centerSize', 0.5, { uiType: 'slider', label: 'Center Size', min: 0.1, max: 2, step: 0.05 })],
            ['centerColor', new Property<string>('centerColor', '#ffffff', { uiType: 'color', label: 'Center Color' })],
            // Pulse Spheres
            ['pulseMaxSize', new Property<number>('pulseMaxSize', 1.2, { uiType: 'slider', label: 'Pulse Max Size', min: 0.1, max: 5, step: 0.1 })],
            ['pulseMaxRadius', new Property<number>('pulseMaxRadius', 5.0, { uiType: 'slider', label: 'Pulse Max Radius', min: 0.5, max: 15, step: 0.1 })],
            ['pulseColor', new Property<string>('pulseColor', '#00ffff', { uiType: 'color', label: 'Pulse Color' })],
            ['pulseExpansionSpeed', new Property<number>('pulseExpansionSpeed', 4.0, { uiType: 'slider', label: 'Pulse Expand Speed', min: 0.1, max: 20, step: 0.1 })],
            // Rotation
            ['rotateSpeed', new Property<number>('rotateSpeed', 10, { uiType: 'slider', label: 'Rotation Speed (°/s)', min: 0, max: 90, step: 1 })],
            // ADSR for Pulse Fade/Expansion
            ['attack', new Property<number>('attack', 0.02, { uiType: 'slider', label: 'Pulse Attack (s)', min: 0.01, max: 0.5, step: 0.005 })],
            ['decay', new Property<number>('decay', 0.3, { uiType: 'slider', label: 'Pulse Decay (s)', min: 0.05, max: 2, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 0, { uiType: 'slider', label: 'Pulse Sustain', min: 0, max: 1, step: 0.01, readOnly: true })], // Sustain should be 0 for pulse
            ['release', new Property<number>('release', 0.1, { uiType: 'slider', label: 'Pulse Release (s)', min: 0.01, max: 1, step: 0.01 })],
        ]);
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;
        const NUM_PULSE_SPHERES = 6;

        this.engine.defineObject('sphere') // Define the outward pulse spheres
            .forEachInstance((ctx: MappingContext) => {
                const instances = [];
                for (let i = 0; i < NUM_PULSE_SPHERES; i++) {
                    // Calculate angle in radians for each sphere
                    instances.push({ angle: (i * 2 * Math.PI) / NUM_PULSE_SPHERES });
                }
                return instances;
            })
            .applyADSR((noteCtx): ADSRConfig => ({ 
                attack: this.getPropertyValue<number>('attack') ?? 0.02,
                decay: this.getPropertyValue<number>('decay') ?? 0.3,
                sustain: 0, // Force sustain to 0 for a pulse effect
                release: this.getPropertyValue<number>('release') ?? 0.1,
            }))
            .withPosition((ctx: MappingContext) => {
                // Remove pulseMaxRadius, use expansion speed instead
                // const pulseMaxRadius = this.getPropertyValue<number>('pulseMaxRadius') ?? 5.0;
                const pulseExpansionSpeed = this.getPropertyValue<number>('pulseExpansionSpeed') ?? 4.0;
                const rotateSpeedDeg = this.getPropertyValue<number>('rotateSpeed') ?? 10;
                const rotateSpeedRad = rotateSpeedDeg * (Math.PI / 180); // Convert to radians per second
                const secondsPerBeat = 60 / ctx.bpm;
                const currentTimeSeconds = ctx.time * secondsPerBeat;

                // Calculate current radius based on time since note start and expansion speed
                const currentRadius = ctx.timeSinceNoteStart * pulseExpansionSpeed;
                
                // Calculate base XY position based on instance angle and current radius
                const baseX = currentRadius * Math.cos(ctx.instanceData.angle);
                const baseY = currentRadius * Math.sin(ctx.instanceData.angle);

                // Calculate overall rotation based on global time
                const currentRotation = currentTimeSeconds * rotateSpeedRad;

                // Apply rotation around Z-axis (for XY plane)
                const rotatedX = baseX * Math.cos(currentRotation) - baseY * Math.sin(currentRotation);
                const rotatedY = baseX * Math.sin(currentRotation) + baseY * Math.cos(currentRotation);

                return [rotatedX, rotatedY, 0]; // Keep Z at 0
            })
            .withScale((ctx: MappingContext) => {
                const pulseMaxSize = this.getPropertyValue<number>('pulseMaxSize') ?? 1.2;
                // Scale still driven by ADSR amplitude for initial pulse
                const scale = MUtils.mapValue(ctx.adsrAmplitude ?? 0, 0, 1, 0, pulseMaxSize);
                return Math.max(0.001, scale); 
            })
            .withColor((ctx: MappingContext) => {
                return this.getPropertyValue<string>('pulseColor') ?? '#00ffff';
            })
            .withOpacity((ctx: MappingContext) => {
                // Fade directly with ADSR amplitude
                return ctx.adsrAmplitude ?? 0;
            });
    }

    // Override getObjectsAtTime to add the central sphere
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // Get the note-triggered pulse spheres from the engine
        const pulseSpheres = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

        // Get properties for the central sphere and rotation
        const centerSize = this.getPropertyValue<number>('centerSize') ?? 0.5;
        const centerColor = this.getPropertyValue<string>('centerColor') ?? '#ffffff';
        const rotateSpeedDeg = this.getPropertyValue<number>('rotateSpeed') ?? 10;
        const rotateSpeedRad = rotateSpeedDeg * (Math.PI / 180); // Convert to radians per second
        const secondsPerBeat = 60 / bpm;
        const currentTimeSeconds = time * secondsPerBeat;

        // Calculate current rotation (around Y axis for the central sphere)
        const currentRotationY = currentTimeSeconds * rotateSpeedRad;

        // Manually create the central sphere object
        const centerSphere: VisualObject = {
            type: 'sphere',
            properties: {
                position: [0, 0, 0],
                scale: [centerSize, centerSize, centerSize],
                rotation: [0, currentRotationY * (180/Math.PI), 0], // Apply rotation in degrees
                color: centerColor,
                opacity: 1, 
            },
            sourceNoteId: null // Not tied to a specific note
        };

        // Return the central sphere combined with the pulse spheres
        return [centerSphere, ...pulseSpheres];
    }

    // Standard clone method
    clone(): this {
        const cloned = new RadialPulseSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default RadialPulseSynth; 