import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, ColorRange, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, ADSRConfig, InstanceData } from '../VisualObjectEngine';

class MountainRushSynth extends Synthesizer {
    protected engine: VisualObjectEngine;
    private baseTime: number = 0; // Track base time for continuous movement
    private accumulatedDistance: number = 0; // Track total distance from all speed boosts
    private lastUpdateTime: number = 0; // Track when we last updated accumulated distance

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this);
        this.initializeEngine();
    }

    clone(): this {
        const cloned = new MountainRushSynth() as this;
        this.properties.forEach((prop, key) => {
            cloned.setPropertyValue(key, prop.value);
        });
        // Clone the accumulated state
        cloned.baseTime = this.baseTime;
        cloned.accumulatedDistance = this.accumulatedDistance;
        cloned.lastUpdateTime = this.lastUpdateTime;
        return cloned;
    }

    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const secondsPerBeat = 60 / bpm;
        const currentTimeSeconds = time * secondsPerBeat;
        
        // Calculate the time delta since last update
        const deltaTime = currentTimeSeconds - this.lastUpdateTime;
        
        if (deltaTime > 0) {
            // Calculate current speed boost from all active MIDI notes
            let totalSpeedBoost = 0;
            const baseSpeed = this.getPropertyValue<number>('baseSpeed') ?? 2.0;
            const maxSpeedMultiplier = this.getPropertyValue<number>('maxSpeedMultiplier') ?? 3.0;
            
            midiBlocks.forEach(block => {
                const blockAbsoluteStartBeat = block.startBeat;
                block.notes.forEach(note => {
                    const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                    const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                    const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                    const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;
                    
                    // Check if note is currently active
                    if (currentTimeSeconds >= noteStartSec && currentTimeSeconds <= noteEndSec) {
                        const timeSinceNoteStart = currentTimeSeconds - noteStartSec;
                        const noteDurationSeconds = (noteAbsoluteEndBeat - noteAbsoluteStartBeat) * secondsPerBeat;
                        
                        // Calculate ADSR for this note (simplified)
                        const attack = this.getPropertyValue<number>('attack') ?? 0.1;
                        const decay = this.getPropertyValue<number>('decay') ?? 0.5;
                        const sustain = this.getPropertyValue<number>('sustain') ?? 0.3;
                        const release = this.getPropertyValue<number>('release') ?? 1.0;
                        
                        let adsrAmplitude = 0;
                        if (currentTimeSeconds <= noteEndSec) {
                            // During note
                            if (timeSinceNoteStart < attack) {
                                adsrAmplitude = timeSinceNoteStart / attack;
                            } else if (timeSinceNoteStart < attack + decay) {
                                const decayProgress = (timeSinceNoteStart - attack) / decay;
                                adsrAmplitude = 1.0 - ((1.0 - sustain) * decayProgress);
                            } else {
                                adsrAmplitude = sustain;
                            }
                        } else {
                            // Release phase
                            const timeIntoRelease = currentTimeSeconds - noteEndSec;
                            if (timeIntoRelease < release) {
                                adsrAmplitude = sustain * (1.0 - (timeIntoRelease / release));
                            }
                        }
                        
                        // Add this note's speed boost
                        const speedBoost = adsrAmplitude * (maxSpeedMultiplier - 1) * baseSpeed;
                        totalSpeedBoost += speedBoost;
                    }
                });
            });
            
            // Accumulate the distance traveled with current speed boost
            const currentSpeed = baseSpeed + totalSpeedBoost;
            this.accumulatedDistance += currentSpeed * deltaTime;
        }
        
        this.lastUpdateTime = currentTimeSeconds;
        this.baseTime = time;
        
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    private initializeProperties(): void {
        this.properties.set('mountainCount', new Property<number>(
            'mountainCount',
            12,
            { label: 'Mountain Count', uiType: 'slider', min: 5, max: 30, step: 1 }
        ));
        this.properties.set('baseSpeed', new Property<number>(
            'baseSpeed',
            2.0,
            { label: 'Base Movement Speed', uiType: 'slider', min: 0.5, max: 8.0, step: 0.1 }
        ));
        this.properties.set('maxSpeedMultiplier', new Property<number>(
            'maxSpeedMultiplier',
            3.0,
            { label: 'Max Speed Multiplier', uiType: 'slider', min: 1.0, max: 10.0, step: 0.1 }
        ));
        this.properties.set('mountainHeight', new Property<number>(
            'mountainHeight',
            4.0,
            { label: 'Mountain Height', uiType: 'slider', min: 1.0, max: 10.0, step: 0.1 }
        ));
        this.properties.set('mountainWidth', new Property<number>(
            'mountainWidth',
            1.5,
            { label: 'Mountain Width', uiType: 'slider', min: 0.5, max: 5.0, step: 0.1 }
        ));
        this.properties.set('spawnDistance', new Property<number>(
            'spawnDistance',
            50.0,
            { label: 'Spawn Distance', uiType: 'slider', min: 20.0, max: 100.0, step: 5.0 }
        ));
        this.properties.set('jaggedness', new Property<number>(
            'jaggedness',
            0.3,
            { label: 'Mountain Jaggedness', uiType: 'slider', min: 0.0, max: 1.0, step: 0.05 }
        ));
        this.properties.set('hueRange', new Property<ColorRange>(
            'hueRange',
            { startHue: 0, endHue: 0 },
            { label: 'Mountain Color Range', uiType: 'colorRange' }
        ));
        this.properties.set('velocityColorShift', new Property<number>(
            'velocityColorShift',
            40,
            { label: 'Velocity Color Shift', uiType: 'slider', min: 0, max: 120, step: 5 }
        ));
        this.properties.set('attack', new Property<number>(
            'attack',
            0.1,
            { label: 'Speed Attack (s)', uiType: 'slider', min: 0.0, max: 2.0, step: 0.05 }
        ));
        this.properties.set('decay', new Property<number>(
            'decay',
            0.5,
            { label: 'Speed Decay (s)', uiType: 'slider', min: 0.0, max: 3.0, step: 0.05 }
        ));
        this.properties.set('sustain', new Property<number>(
            'sustain',
            0.3,
            { label: 'Speed Sustain Level', uiType: 'slider', min: 0.0, max: 1.0, step: 0.01 }
        ));
        this.properties.set('release', new Property<number>(
            'release',
            1.0,
            { label: 'Speed Release (s)', uiType: 'slider', min: 0.1, max: 5.0, step: 0.1 }
        ));
    }

    private initializeEngine(): void {
        const adsrConfigFn = (noteCtx: NoteContext): ADSRConfig => ({
            attack: this.getPropertyValue<number>('attack') ?? 0.1,
            decay: this.getPropertyValue<number>('decay') ?? 0.5,
            sustain: this.getPropertyValue<number>('sustain') ?? 0.3,
            release: this.getPropertyValue<number>('release') ?? 1.0,
        });

        this.engine.defineObject('cube')
            .applyADSR(adsrConfigFn)
            .forEachInstance((ctx: MappingContext): InstanceData[] => {
                const mountainCount = this.getPropertyValue<number>('mountainCount') ?? 12;
                const jaggedness = this.getPropertyValue<number>('jaggedness') ?? 0.3;
                const instances: InstanceData[] = [];
                
                // Create a row of mountains across the horizon
                // Use deterministic values based on note ID to avoid regeneration
                const seed = ctx.note.pitch + ctx.note.velocity;
                
                for (let i = 0; i < mountainCount; i++) {
                    const x = (i - mountainCount / 2) * 3; // Spread mountains across X axis
                    
                    // Use deterministic pseudo-random values based on seed and index
                    const heightSeed = (seed + i * 137) % 1000 / 1000; // Pseudo-random 0-1
                    const widthSeed = (seed + i * 241) % 1000 / 1000;
                    const zSeed = (seed + i * 359) % 1000 / 1000;
                    
                    const heightVariation = (heightSeed - 0.5) * jaggedness * 2;
                    const widthVariation = (widthSeed - 0.5) * jaggedness;
                    
                    instances.push({
                        id: i,
                        xPosition: x,
                        heightVariation: heightVariation,
                        widthVariation: widthVariation,
                        zOffset: (zSeed - 0.5) * 20 // Deterministic depth variation
                    });
                }
                
                return instances;
            })
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const spawnDistance = this.getPropertyValue<number>('spawnDistance') ?? 50.0;
                
                // Use the accumulated distance that includes all past speed boosts
                let totalDistance = this.accumulatedDistance;
                
                // Calculate Z position - mountains move toward camera
                const baseZ = -spawnDistance + totalDistance;
                let zPos = baseZ + ctx.instanceData.zOffset;
                
                // Handle looping: when mountains go behind camera, reset the accumulated distance
                const resetDistance = spawnDistance + 20;
                if (zPos > 10) {
                    // Reset accumulated distance to loop the mountains
                    this.accumulatedDistance = this.accumulatedDistance % resetDistance;
                    totalDistance = this.accumulatedDistance;
                    zPos = -spawnDistance + totalDistance + ctx.instanceData.zOffset;
                }
                
                const x = ctx.instanceData.xPosition;
                const y = -2; // Ground level
                
                return [x, y, zPos];
            })
            .withScale((ctx: MappingContext): [number, number, number] => {
                const mountainHeight = this.getPropertyValue<number>('mountainHeight') ?? 4.0;
                const mountainWidth = this.getPropertyValue<number>('mountainWidth') ?? 1.5;
                
                // Apply height and width variations
                const height = mountainHeight * (1 + ctx.instanceData.heightVariation);
                const width = mountainWidth * (1 + ctx.instanceData.widthVariation);
                
                // Scale based on velocity for some dynamic variation
                const velocityScale = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.8, 1.2);
                
                return [width * velocityScale, height * velocityScale, width * 0.5];
            })
            .withColor((ctx: MappingContext): string => {
                // Dark grey/black mountains with slight variation
                const mountainIndex = ctx.instanceData.id;
                const mountainCount = this.getPropertyValue<number>('mountainCount') ?? 12;
                
                // Create subtle variation in darkness across mountains
                const variation = (mountainIndex / mountainCount) * 10; // 0-10% variation
                
                // ADSR can make mountains slightly lighter during speed boosts
                const adsrBrightness = (ctx.adsrAmplitude ?? 0) * 15;
                
                // Velocity adds slight brightness variation
                const velocityBrightness = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0, 10);
                
                // Keep mountains dark - base lightness around 15-25%
                const baseLightness = 15;
                const finalLightness = Math.min(35, baseLightness + variation + adsrBrightness + velocityBrightness);
                
                // Very low saturation for grey/black appearance
                const saturation = 5;
                const hue = 0; // Doesn't matter much with low saturation
                
                return `hsl(${hue}, ${saturation}%, ${finalLightness.toFixed(0)}%)`;
            })
            .withOpacity((ctx: MappingContext): number => {
                const spawnDistance = this.getPropertyValue<number>('spawnDistance') ?? 50.0;
                
                // Use the same looped distance calculation as position
                let totalDistance = this.accumulatedDistance;
                const resetDistance = spawnDistance + 20;
                if (totalDistance > resetDistance) {
                    totalDistance = totalDistance % resetDistance;
                }
                
                const estimatedZ = -spawnDistance + totalDistance;
                const distanceFade = Math.max(0.3, Math.min(1.0, (50 + estimatedZ) / 60));
                
                // Velocity affects visibility
                const velocityOpacity = MappingUtils.mapValue(ctx.note.velocity, 0, 127, 0.6, 1.0);
                
                // ADSR affects intensity
                const adsrOpacity = 0.7 + (ctx.adsrAmplitude ?? 0) * 0.3;
                
                return distanceFade * velocityOpacity * adsrOpacity;
            });
    }
}

export default MountainRushSynth;