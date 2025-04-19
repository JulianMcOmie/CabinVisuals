import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, NoteContext, MappingUtils } from '../VisualObjectEngine';
import * as THREE from 'three'; // Import THREE for vector operations

// Helper function for linear interpolation (lerp) between two points
function lerpPositions(start: [number, number, number], end: [number, number, number], t: number): [number, number, number] {
    const clampedT = Math.max(0, Math.min(1, t)); // Ensure t is between 0 and 1
    return [
        start[0] + (end[0] - start[0]) * clampedT,
        start[1] + (end[1] - start[1]) * clampedT,
        start[2] + (end[2] - start[2]) * clampedT
    ];
}

class FireworkSynth extends Synthesizer {
    protected engine: VisualObjectEngine;

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new FireworkSynth() as this;
        this.properties.forEach((prop, key) => {
            const originalProp = this.properties.get(key);
            if (originalProp) {
                cloned.setPropertyValue(key, originalProp.value);
            }
        });
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        // Get base objects from the engine
        const baseObjects = this.engine.getObjectsAtTime(time, midiBlocks, bpm);

        // Post-process to add emissive properties for glow
        const processedObjects = baseObjects.map(obj => {
            if (!obj.properties || obj.properties.opacity === undefined || !obj.properties.color) {
                return obj; // Skip if essential properties are missing
            }

            const baseIntensity = this.getPropertyValue<number>('glowIntensity') ?? 1.0;
            // Ensure opacity is treated as 0 if it's very close to 0
            const effectiveOpacity = obj.properties.opacity < 0.01 ? 0 : obj.properties.opacity;
            const intensity = baseIntensity * effectiveOpacity;

            return {
                ...obj,
                properties: {
                    ...obj.properties,
                    emissive: obj.properties.color, // Set emissive color based on object color
                    emissiveIntensity: intensity // Set intensity based on property & opacity
                }
            };
        });

        return processedObjects;
    }

    private initializeProperties(): void {
        this.properties.set('baseColor', new Property<string>(
            'baseColor',
            '#ffffff',
            { label: 'Particle Color', uiType: 'color' }
        ));
        this.properties.set('particleCount', new Property<number>(
            'particleCount',
            30,
            { label: 'Particle Count', uiType: 'slider', min: 5, max: 100, step: 1 }
        ));
        this.properties.set('burstSpread', new Property<number>(
            'burstSpread',
            2.5,
            { label: 'Burst Spread Radius', uiType: 'slider', min: 0.1, max: 10, step: 0.1 }
        ));
        this.properties.set('particleLifetime', new Property<number>(
            'particleLifetime',
            1.5,
            { label: 'Particle Lifetime (s)', uiType: 'slider', min: 0.1, max: 5, step: 0.1 }
        ));
        this.properties.set('glowIntensity', new Property<number>(
            'glowIntensity',
            2.0,
            { label: 'Glow Intensity', uiType: 'slider', min: 0.0, max: 10, step: 0.1 }
        ));
        this.properties.set('particleSize', new Property<number>(
            'particleSize',
            0.05,
            { label: 'Particle Size', uiType: 'slider', min: 0.01, max: 0.5, step: 0.01 }
        ));
    }

    private initializeEngine(): void {
        // Define fixed vertical range for pitch mapping
        const yMin = -5;
        const yMax = 5;

        this.engine.defineObject('particleSphere')
            // 1. Calculate the center position for the burst based on the note
            .withPosition((ctx: MappingContext): [number, number, number] => [
                0, // X position fixed at 0
                MappingUtils.mapPitchToRange(ctx.note.pitch, yMin, yMax), // Map pitch to Y range
                0  // Z position fixed at 0
            ])
            // 2. Generate multiple particle instances per note
            .forEachInstance((ctx: MappingContext) => { // ctx here is the parent context
                const count = this.getPropertyValue<number>('particleCount') ?? 30;
                const spread = this.getPropertyValue<number>('burstSpread') ?? 2.5;
                const instances = [];
                // Get the calculated center position from the parent context's properties
                const centerPosition = ctx.calculatedProperties?.position ?? [0, 0, 0];

                for (let i = 0; i < count; i++) {
                    // Random direction (spherical coordinates)
                    const theta = Math.random() * 2 * Math.PI; // Azimuthal angle
                    const phi = Math.acos(2 * Math.random() - 1); // Polar angle

                    // Calculate offset vector from center
                    const offsetX = spread * Math.sin(phi) * Math.cos(theta);
                    const offsetY = spread * Math.sin(phi) * Math.sin(theta);
                    const offsetZ = spread * Math.cos(phi);

                    // Calculate the target position for this particle
                    const targetPosition: [number, number, number] = [
                        centerPosition[0] + offsetX,
                        centerPosition[1] + offsetY,
                        centerPosition[2] + offsetZ
                    ];

                    // Store both center and target positions
                    instances.push({ centerPosition, targetPosition });
                }
                return instances;
            })
            // 3. Set the final properties for each particle instance
            // Position: Interpolate from centerPosition to targetPosition over lifetime
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const lifetime = this.getPropertyValue<number>('particleLifetime') ?? 1.5;
                const centerPos = ctx.instanceData?.centerPosition ?? [0, 0, 0];
                const targetPos = ctx.instanceData?.targetPosition ?? centerPos; // Default target to center if missing

                if (lifetime <= 0) return targetPos; // If no lifetime, jump to end

                const progress = ctx.timeSinceNoteStart / lifetime;

                // Use helper function to lerp
                return lerpPositions(centerPos, targetPos, progress);
            })
            .withColor((ctx: MappingContext) => this.getPropertyValue('baseColor') ?? '#ffffff')
            .withScale((ctx: MappingContext) => {
                 const size = this.getPropertyValue<number>('particleSize') ?? 0.05;
                 return [size, size, size];
            })
            // Opacity: Fade out based on time since note start and lifetime
            .withOpacity((ctx: MappingContext) => {
                const lifetime = this.getPropertyValue<number>('particleLifetime') ?? 1.5;
                if (lifetime <= 0) return 0; // Avoid division by zero
                // Calculate progress (0 = start, 1 = end of life)
                const progress = ctx.timeSinceNoteStart / lifetime;
                // Linear fade out (1 -> 0)
                const opacity = 1.0 - progress;
                // Clamp opacity between 0 and 1
                return Math.max(0, Math.min(1, opacity));
            });
    }
}

export default FireworkSynth; 