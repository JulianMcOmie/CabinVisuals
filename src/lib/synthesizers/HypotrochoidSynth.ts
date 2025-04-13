import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';

type Vec3 = [number, number, number];

class HypotrochoidSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    private initializeProperties(): void {
        this.properties = new Map<string, Property<any>>([
            // Hypotrochoid params
            ['largeR', new Property<number>('largeR', 5, { uiType: 'slider', label: 'Large Radius (R)', min: 1, max: 10, step: 0.1 })],
            ['smallR', new Property<number>('smallR', 2, { uiType: 'slider', label: 'Small Radius (r)', min: 0.1, max: 10, step: 0.1 })],
            ['distanceD', new Property<number>('distanceD', 3, { uiType: 'slider', label: 'Distance (d)', min: 0.1, max: 10, step: 0.1 })],
            ['numSpheres', new Property<number>('numSpheres', 80, { uiType: 'numberInput', label: 'Spheres per Path', min: 10, max: 500, step: 5 })],
            ['sphereSize', new Property<number>('sphereSize', 0.08, { uiType: 'slider', label: 'Sphere Size', min: 0.01, max: 0.5, step: 0.005 })],
            // Radial copies
            ['minCopies', new Property<number>('minCopies', 1, { uiType: 'numberInput', label: 'Min Radial Copies', min: 1, max: 12, step: 1 })],
            ['radialSpread', new Property<number>('radialSpread', 0, { uiType: 'slider', label: 'Radial Spread Offset', min: 0, max: 5, step: 0.1 })], // Offset duplicates radially
             // Dynamics
            ['radiusOscFreq', new Property<number>('radiusOscFreq', 0.5, { uiType: 'slider', label: 'Radius Osc Freq (Hz)', min: 0.1, max: 5, step: 0.1 })],
            ['radiusOscDepth', new Property<number>('radiusOscDepth', 0.2, { uiType: 'slider', label: 'Radius Osc Depth', min: 0, max: 1, step: 0.05 })],
            ['rotationSpeed', new Property<number>('rotationSpeed', 10, { uiType: 'slider', label: 'Base Rotation (°/s)', min: -90, max: 90, step: 1 })],
            ['rotationOscFreq', new Property<number>('rotationOscFreq', 0.3, { uiType: 'slider', label: 'Rotation Osc Freq (Hz)', min: 0.1, max: 5, step: 0.1 })],
            ['rotationOscDepth', new Property<number>('rotationOscDepth', 15, { uiType: 'slider', label: 'Rotation Osc Depth (°)', min: 0, max: 90, step: 1 })],
            // Color
            ['hueStart', new Property<number>('hueStart', 0, { uiType: 'slider', label: 'Hue Start', min: 0, max: 360, step: 1 })],
            ['hueRange', new Property<number>('hueRange', 360, { uiType: 'slider', label: 'Hue Range', min: 0, max: 720, step: 5 })],
            // ADSR
            ['attack', new Property<number>('attack', 0.5, { uiType: 'slider', label: 'Fade In (s)', min: 0.01, max: 3, step: 0.01 })],
            ['decay', new Property<number>('decay', 0.2, { uiType: 'slider', label: 'Settle Time (s)', min: 0.01, max: 1, step: 0.01 })],
            ['sustain', new Property<number>('sustain', 1.0, { uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01 })],
            ['release', new Property<number>('release', 1.5, { uiType: 'slider', label: 'Fade Out (s)', min: 0.1, max: 5, step: 0.05 })],
        ]);
    }

    // Hypotrochoid function
    private calculateHypotrochoidPoint(theta: number, R: number, r: number, d: number): { x: number, z: number } {
        const RmR = R - r;
        const angleRatio = RmR / r;
        const x = RmR * Math.cos(theta) + d * Math.cos(angleRatio * theta);
        const z = RmR * Math.sin(theta) - d * Math.sin(angleRatio * theta);
        // Plotting on XZ plane
        return { x, z };
    }

    private initializeEngine(): void {
        const MUtils = MappingUtils;

        this.engine.defineObject('sphere') // Default type for spheres
            // --- Level 1: Radial Duplicates --- //
            .forEachInstance((rootCtx: MappingContext) => {
                // Generate data for each radial copy based on pitch
                const pitchMod12 = rootCtx.note.pitch % 12;
                const minCopies = this.getPropertyValue<number>('minCopies') ?? 1;
                const numCopies = minCopies + pitchMod12;
                const instances: InstanceData[] = [];
                const angleStep = (2 * Math.PI) / numCopies;

                for (let i = 0; i < numCopies; i++) {
                    instances.push({ radialIndex: i, radialAngle: i * angleStep, totalCopies: numCopies });
                }
                return instances;
            })
            .applyADSR((noteCtx: NoteContext) => ({ // ADSR for overall effect fade & radius osc amplitude
                attack: this.getPropertyValue<number>('attack') ?? 0.5,
                decay: this.getPropertyValue<number>('decay') ?? 0.2,
                sustain: this.getPropertyValue<number>('sustain') ?? 1.0,
                release: this.getPropertyValue<number>('release') ?? 1.5,
            }))
            // Level 1 modifiers apply *before* the next forEachInstance (to Level 1 itself, though it creates no direct objects)
            // We store dynamic values needed by children in the Level 1 context's instanceData
            .withPosition((ctx: MappingContext) => {
                 // This mapper runs for each Level 1 instance (radial copy)
                 // Calculate dynamic values needed by child spheres and store them.
                 const radiusOscFreq = this.getPropertyValue<number>('radiusOscFreq') ?? 0.5;
                 const radiusOscDepth = this.getPropertyValue<number>('radiusOscDepth') ?? 0.2;
                 const rotationSpeed = this.getPropertyValue<number>('rotationSpeed') ?? 10;
                 const rotationOscFreq = this.getPropertyValue<number>('rotationOscFreq') ?? 0.3;
                 const rotationOscDepth = this.getPropertyValue<number>('rotationOscDepth') ?? 15;

                 const time = ctx.timeSinceNoteStart;
                 const adsrAmp = ctx.adsrAmplitude ?? 0;

                 // Calculate current radius oscillation factor (1 +/- depth)
                 const radiusOscPhase = time * radiusOscFreq * 2 * Math.PI;
                 const radiusOscFactor = 1 + Math.sin(radiusOscPhase) * radiusOscDepth * adsrAmp; // Osc depth scales with ADSR

                 // Calculate current total rotation angle
                 const baseRotation = time * rotationSpeed;
                 const rotationOscPhase = time * rotationOscFreq * 2 * Math.PI;
                 const rotationOscOffset = Math.sin(rotationOscPhase) * rotationOscDepth * adsrAmp;
                 const currentYRotation = baseRotation + rotationOscOffset;

                 // Store these calculated values in instanceData for children to access
                 ctx.instanceData.currentRadiusOscFactor = radiusOscFactor;
                 ctx.instanceData.currentYRotation = currentYRotation;

                return [0,0,0]; // Level 1 produces no visual object itself, position irrelevant
            })

            // --- Level 2: Spheres along Hypotrochoid Path --- //
            .forEachInstance((parentCtx: MappingContext) => {
                // Generate data for spheres along the path of the parent radial copy
                const numSpheres = this.getPropertyValue<number>('numSpheres') ?? 80;
                const instances: InstanceData[] = [];
                // Fix Linter Error: Provide default for smallR and ensure Math.abs gets a number
                const smallRadiusForRange = this.getPropertyValue<number>('smallR') ?? 2;
                // Determine full range for theta based on R, r (LCM calculation needed for perfect closure)
                // For simplicity, let's just run it for a fixed large range (e.g. 10 rotations) scaled by r?
                const thetaRange = Math.abs(smallRadiusForRange) * 2 * Math.PI * 5; // Heuristic range

                for (let i = 0; i < numSpheres; i++) {
                    // const theta = i * thetaStep;
                    const theta = (i / numSpheres) * thetaRange;
                    instances.push({ sphereIndex: i, theta: theta });
                }
                return instances;
            })
            // Configure the individual spheres (Level 2 instances)
            .withPosition((ctx: MappingContext) => {
                const R = this.getPropertyValue<number>('largeR') ?? 5;
                // Get base small R
                const baseSmallR = this.getPropertyValue<number>('smallR') ?? 2;
                const d = this.getPropertyValue<number>('distanceD') ?? 3;
                const radialSpread = this.getPropertyValue<number>('radialSpread') ?? 0;

                // --- Pitch Modulation of smallR --- //
                const pitchMod12 = ctx.note.pitch % 12; // 0-11
                // Map pitch (0-11) to a scaling factor for smallR (e.g., 1.2 down to 0.5)
                // Lower pitch -> larger effective r (lower freq), Higher pitch -> smaller effective r (higher freq)
                const smallRScaleFactor = MUtils.mapValue(pitchMod12, 0, 11, 1.2, 0.5);
                // Ensure effectiveSmallR is positive and not too small
                const effectiveSmallR = Math.max(0.1, baseSmallR * smallRScaleFactor);
                // --- End Pitch Modulation ---

                // Get calculated values from parent (Level 1) context
                const radiusOscFactor = ctx.parentContext?.instanceData.currentRadiusOscFactor ?? 1;
                const currentYRotation = ctx.parentContext?.instanceData.currentYRotation ?? 0;
                const parentRadialAngle = ctx.parentContext?.instanceData.radialAngle ?? 0;

                const theta = ctx.instanceData.theta as number;

                // 1. Calculate base hypotrochoid point using effectiveSmallR
                const { x: baseX, z: baseZ } = this.calculateHypotrochoidPoint(theta, R, effectiveSmallR, d);

                // 2. Apply radius oscillation
                let currentX = baseX * radiusOscFactor;
                let currentZ = baseZ * radiusOscFactor;

                // 3. Apply radial offset (push duplicates outwards)
                if (radialSpread > 0) {
                    currentX += Math.cos(parentRadialAngle) * radialSpread;
                    currentZ += Math.sin(parentRadialAngle) * radialSpread;
                }

                // 4. Apply overall rotation (around Y axis)
                const rotRad = currentYRotation * (Math.PI / 180);
                const cosRot = Math.cos(rotRad);
                const sinRot = Math.sin(rotRad);
                let rotatedX = currentX * cosRot - currentZ * sinRot;
                let rotatedZ = currentX * sinRot + currentZ * cosRot;

                // 5. Apply the parent's specific radial rotation (position the duplicate)
                const cosRadial = Math.cos(parentRadialAngle);
                const sinRadial = Math.sin(parentRadialAngle);
                const finalX = rotatedX * cosRadial - rotatedZ * sinRadial;
                const finalZ = rotatedX * sinRadial + rotatedZ * cosRadial;

                return [finalX, finalZ, 0]; // Keep flat on XZ plane
            })
            .withScale((ctx: MappingContext) => {
                // Use parent's ADSR amplitude for scale?
                const amplitude = ctx.parentContext?.adsrAmplitude ?? 0;
                const sphereSize = this.getPropertyValue<number>('sphereSize') ?? 0.08;
                return sphereSize * amplitude;
            })
            .withColor((ctx: MappingContext) => {
                const theta = ctx.instanceData.theta as number;
                const hueStart = this.getPropertyValue<number>('hueStart') ?? 0;
                const hueRange = this.getPropertyValue<number>('hueRange') ?? 360;
                 // Map theta to hue (normalize theta first? use modulo?)
                 const thetaNormalized = (theta / (2*Math.PI)) % 1.0; // Normalize based on 2*PI cycle
                const hue = (hueStart + thetaNormalized * hueRange) % 360;
                const saturation = 90;
                const lightness = 60;
                return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
            })
            .withOpacity((ctx: MappingContext) => ctx.parentContext?.adsrAmplitude ?? 0); // Opacity from parent ADSR
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    clone(): this {
        const cloned = new HypotrochoidSynth() as this;
        this.properties.forEach((property, name) => {
            const clonedProperty = cloned.properties.get(name);
            if (clonedProperty) {
                clonedProperty.value = property.value;
            }
        });
        return cloned;
    }
}

export default HypotrochoidSynth; 