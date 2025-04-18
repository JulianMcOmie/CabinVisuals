import { MIDINote, MIDIBlock, VisualObject } from './types';
import Synthesizer from './Synthesizer'; // Assuming Synthesizer provides getPropertyValue

// --- Interfaces and Types ---

interface VisualObjectProperties {
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  rotation?: [number, number, number];
  color?: string;
  opacity?: number;
  // Add other potential properties as needed
}

interface NoteContext {
  note: MIDINote;
  // Synthesizer properties are accessed via `this` in the function scope
}

interface InstanceData {
  // User-defined data passed between generator levels
  [key: string]: any;
}

interface MappingContext {
  note: MIDINote;
  time: number; // Current global time (beats)
  bpm: number;
  timeSinceNoteStart: number; // Seconds
  noteProgressPercent: number; // 0-1
  noteDurationSeconds: number;
  level: number; // Nesting depth (1 = initial)
  instanceData: InstanceData; // Data from .forEachInstance generator
  parentContext?: MappingContext; // Context of the parent
  adsrAmplitude?: number; // Current ADSR amplitude (0-1)
  adsrPhase?: 'attack' | 'decay' | 'sustain' | 'release' | 'idle'; // Current ADSR phase
  calculatedProperties?: VisualObjectProperties; // Read-only view of properties calculated so far
  // synthesizer: Synthesizer; // Direct access might be complex due to `this` binding
}

type ConditionFn = (noteCtx: NoteContext) => boolean;
type GeneratorFn = (parentContext: MappingContext) => InstanceData[];
type MapperFn<T> = (ctx: MappingContext) => T;
type ADSRConfig = { attack: number; decay: number; sustain: number; release: number };
type ADSRConfigFn = (noteCtx: NoteContext) => ADSRConfig;

// --- Mapping Utilities ---

class MappingUtils {
    static mapValue(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clamp: boolean = true): number {
        let result = outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
        if (clamp) {
            result = Math.max(outMin, Math.min(outMax, result));
        }
        return result;
    }

    static mapPitchToRange(pitch: number, outMin: number, outMax: number, pitchMin: number = 0, pitchMax: number = 127): number {
        return this.mapValue(pitch, pitchMin, pitchMax, outMin, outMax);
    }

    static mapPitchToHSL(pitch: number, saturation: number, lightness: number, hueStart: number = 0, hueEnd: number = 360, pitchMin: number = 0, pitchMax: number = 127): string {
        const hue = this.mapValue(pitch, pitchMin, pitchMax, hueStart, hueEnd);
        return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
    }

    static mapValueToHSL(value: number, saturation: number, lightness: number, inMin: number, inMax: number, hueStart: number = 0, hueEnd: number = 360): string {
        const hue = this.mapValue(value, inMin, inMax, hueStart, hueEnd);
        return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
    }

    // Add other static utility functions here...
}


// --- Object Definition Level ---
// Represents configuration for a specific level of generated objects

interface DefinitionLevel {
    level: number; // 1-based level index
    generatorFn?: GeneratorFn; // Only present for levels > 1
    type?: string; // Overrides parent/initial type
    positionMapper?: MapperFn<[number, number, number]>;
    scaleMapper?: MapperFn<[number, number, number] | number>;
    rotationMapper?: MapperFn<[number, number, number]>;
    colorMapper?: MapperFn<string>;
    opacityMapper?: MapperFn<number>;
    adsrConfig?: ADSRConfig | ADSRConfigFn; // ADSR for this level
}


// --- Object Definition ---

class ObjectDefinition {
    private engine: VisualObjectEngine;
    private synthesizer: Synthesizer; // Reference to the synthesizer for property access
    initialType: string;
    conditionFn: ConditionFn = () => true; // Default: always execute
    levels: DefinitionLevel[] = []; // Stores config for each nesting level

    constructor(engine: VisualObjectEngine, synthesizer: Synthesizer, initialType: string) {
        this.engine = engine;
        this.synthesizer = synthesizer;
        this.initialType = initialType;
        // Initialize Level 1 implicitly
        this.levels.push({ level: 1 });
    }

    private getCurrentLevelConfig(): DefinitionLevel {
       if (this.levels.length === 0) {
            // Should not happen due to constructor initialization
           throw new Error("ObjectDefinition has no levels configured.");
       }
       return this.levels[this.levels.length - 1];
    }

    when(conditionFn: ConditionFn): this {
        this.conditionFn = conditionFn;
        return this;
    }

    forEachInstance(generatorFn: GeneratorFn): this {
        // Starts a *new* level based on the results of the generator
        const newLevel = this.levels.length + 1;
        this.levels.push({ level: newLevel, generatorFn: generatorFn });
        return this;
    }

    withPosition(mapperFn: MapperFn<[number, number, number]>): this {
        this.getCurrentLevelConfig().positionMapper = mapperFn;
        return this;
    }

    withScale(mapperFn: MapperFn<[number, number, number] | number>): this {
        this.getCurrentLevelConfig().scaleMapper = mapperFn;
        return this;
    }

    withRotation(mapperFn: MapperFn<[number, number, number]>): this {
        this.getCurrentLevelConfig().rotationMapper = mapperFn;
        return this;
    }

    withColor(mapperFn: MapperFn<string>): this {
        this.getCurrentLevelConfig().colorMapper = mapperFn;
        return this;
    }

    withOpacity(mapperFn: MapperFn<number>): this {
        this.getCurrentLevelConfig().opacityMapper = mapperFn;
        return this;
    }

    setType(type: string): this {
        this.getCurrentLevelConfig().type = type;
        return this;
    }

    applyADSR(config: ADSRConfig | ADSRConfigFn): this {
        this.getCurrentLevelConfig().adsrConfig = config;
        return this;
    }
}


// --- Visual Object Engine ---

class VisualObjectEngine {
    private objectDefinitions: ObjectDefinition[] = [];
    private synthesizer: Synthesizer; // Store reference

    // Constructor now requires the Synthesizer instance
    constructor(synthesizer: Synthesizer) {
        this.synthesizer = synthesizer;
    }

    defineObject(initialType: string): ObjectDefinition {
        const definition = new ObjectDefinition(this, this.synthesizer, initialType);
        this.objectDefinitions.push(definition);
        return definition;
    }

     // Helper to calculate ADSR value (simplified example)
    private calculateADSR(time: number, noteStartTime: number, noteEndTime: number, bpm: number, config: ADSRConfig): { amplitude: number; phase: 'attack' | 'decay' | 'sustain' | 'release' | 'idle' } {
        const { attack, decay, sustain, release } = config;
        const secondsPerBeat = 60 / bpm;
        const noteStartSec = noteStartTime * secondsPerBeat;
        const noteEndSec = noteEndTime * secondsPerBeat;
        const currentTimeSec = time * secondsPerBeat;
        const timeFromStart = currentTimeSec - noteStartSec;

        if (timeFromStart < 0) return { amplitude: 0, phase: 'idle' };

        // Attack phase
        if (timeFromStart < attack) {
            const amplitude = attack > 0 ? Math.min(1.0, timeFromStart / attack) : 1.0;
            return { amplitude, phase: 'attack' };
        }

        // Decay phase
        const decayStartTime = attack;
        if (timeFromStart < decayStartTime + decay) {
            const decayProgress = decay > 0 ? (timeFromStart - decayStartTime) / decay : 1.0;
            const amplitude = 1.0 - ((1.0 - sustain) * decayProgress);
            return { amplitude: Math.max(0, amplitude), phase: 'decay' };
        }

        // Sustain phase
        if (currentTimeSec <= noteEndSec) {
             return { amplitude: sustain, phase: 'sustain' };
        }

        // Release phase
        const timeIntoRelease = currentTimeSec - noteEndSec;
        if (timeIntoRelease > 0 && timeIntoRelease < release) {
             const amplitude = release > 0 ? (sustain * (1.0 - (timeIntoRelease / release))) : 0;
             return { amplitude: Math.max(0, amplitude), phase: 'release' };
        }

        return { amplitude: 0, phase: 'idle' }; // Note finished
    }


    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
        const allVisualObjects: VisualObject[] = [];
        const secondsPerBeat = 60 / bpm;

        this.objectDefinitions.forEach(definition => {
            midiBlocks.forEach(block => {
                const blockAbsoluteStartBeat = block.startBeat;

                block.notes.forEach(note => {
                    const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                    const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                    const noteDurationSeconds = note.duration * secondsPerBeat;

                    const noteCtx: NoteContext = { note };

                    // Check if the note triggers this definition chain (using synthesizer context via closure)
                    if (definition.conditionFn.call(this.synthesizer, noteCtx)) {

                        // Recursive function to process levels
                        const processLevel = (
                            levelConfig: DefinitionLevel,
                            parentContext?: MappingContext,
                            parentInstanceData?: InstanceData // Data from parent's generator for this specific instance
                        ): void => {
                            const instancesData: InstanceData[] = [];

                            if (levelConfig.level === 1) {
                                // Level 1 instances: Assume a single instance unless a generator is explicitly added *before* any modifiers for level 1 (not standard use)
                                // We pass a default object to represent the single implicit instance.
                                instancesData.push(parentInstanceData ?? {}); // Use passed data if available (e.g. future root generator)
                            } else if (levelConfig.generatorFn && parentContext) {
                                // Levels > 1: Generate instance data based on parent
                                const generatedData = levelConfig.generatorFn.call(this.synthesizer, parentContext);
                                instancesData.push(...generatedData);
                            } else if (!parentContext && levelConfig.level > 1) {
                                console.warn("Generator function called without parent context for level > 1");
                                return; // Cannot generate instances without parent context
                            } else {
                                 // Level > 1 but no generator? This implies the chain ended or was misconfigured.
                                 return;
                            }


                            instancesData.forEach(instanceData => {
                                const timeSinceNoteStart = Math.max(0, (time - noteAbsoluteStartBeat) * secondsPerBeat);
                                const noteProgressPercent = noteDurationSeconds > 0 ? Math.min(1, Math.max(0, timeSinceNoteStart / noteDurationSeconds)) : 1;

                                // --- ADSR Calculation for this Level ---
                                let adsrAmplitude: number | undefined = undefined;
                                let adsrPhase: 'attack' | 'decay' | 'sustain' | 'release' | 'idle' | undefined = undefined;
                                let currentAdsrConfig: ADSRConfig | undefined = undefined;

                                if (levelConfig.adsrConfig) {
                                    currentAdsrConfig = typeof levelConfig.adsrConfig === 'function'
                                        ? levelConfig.adsrConfig.call(this.synthesizer, noteCtx)
                                        : levelConfig.adsrConfig;

                                    // Calculate ADSR based on the *note's* timing relative to current time
                                    const adsrResult = this.calculateADSR(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm, currentAdsrConfig);
                                    adsrAmplitude = adsrResult.amplitude;
                                    adsrPhase = adsrResult.phase;

                                    // Optimization: If amplitude is zero (and not in release needing processing), skip this instance
                                    if (adsrAmplitude <= 0 && adsrPhase === 'idle') {
                                        return;
                                    }
                                }

                                // --- Create Mapping Context for this Instance ---
                                const currentContext: MappingContext = {
                                    note: note,
                                    time: time,
                                    bpm: bpm,
                                    timeSinceNoteStart: timeSinceNoteStart,
                                    noteProgressPercent: noteProgressPercent,
                                    noteDurationSeconds: noteDurationSeconds,
                                    level: levelConfig.level,
                                    instanceData: instanceData, // Data specific to this instance
                                    parentContext: parentContext,
                                    adsrAmplitude: adsrAmplitude,
                                    adsrPhase: adsrPhase,
                                    // calculatedProperties will be filled below
                                };

                                // --- Apply Mappers ---
                                const calculatedProps: VisualObjectProperties = {};
                                // Important: Access synthesizer properties using .call(this.synthesizer, ...)
                                if (levelConfig.positionMapper) calculatedProps.position = levelConfig.positionMapper.call(this.synthesizer, currentContext);
                                if (levelConfig.scaleMapper) calculatedProps.scale = levelConfig.scaleMapper.call(this.synthesizer, currentContext);
                                if (levelConfig.rotationMapper) calculatedProps.rotation = levelConfig.rotationMapper.call(this.synthesizer, currentContext);
                                if (levelConfig.colorMapper) calculatedProps.color = levelConfig.colorMapper.call(this.synthesizer, currentContext);
                                if (levelConfig.opacityMapper) calculatedProps.opacity = levelConfig.opacityMapper.call(this.synthesizer, currentContext);

                                // Add calculated properties to the context (read-only view for children)
                                currentContext.calculatedProperties = calculatedProps;


                                // Determine the object type for this instance
                                const objectType = levelConfig.type ?? (parentContext?.calculatedProperties as any)?.type ?? definition.initialType; // Cascade type down

                                // --- Create Visual Object ---
                                // Only create an object if essential properties are likely defined (e.g., position/scale often needed)
                                // Add more robust checks or defaults as needed
                                if (calculatedProps.position || calculatedProps.scale) {
                                     const visualObject: VisualObject = {
                                         type: objectType,
                                         properties: {
                                             position: calculatedProps.position ?? [0, 0, 0], // Default position
                                             scale: typeof calculatedProps.scale === 'number'
                                                       ? [calculatedProps.scale, calculatedProps.scale, calculatedProps.scale]
                                                       : calculatedProps.scale ?? [1, 1, 1], // Default scale array
                                             rotation: calculatedProps.rotation ?? [0, 0, 0], // Default rotation
                                             color: calculatedProps.color ?? '#ffffff', // Default color
                                             opacity: calculatedProps.opacity ?? 1, // Default opacity
                                             // Include ADSR info if needed for rendering/debugging
                                             // _adsrAmplitude: adsrAmplitude,
                                             // _adsrPhase: adsrPhase,
                                             // _instanceData: instanceData, // For debugging
                                             // _level: levelConfig.level, // For debugging
                                         },
                                         sourceNoteId: note.id // ** Automatically add sourceNoteId **
                                     };
                                     allVisualObjects.push(visualObject);
                                }


                                // --- Recurse for Next Level ---
                                const nextLevelIndex = definition.levels.findIndex(l => l.level === levelConfig.level + 1);
                                if (nextLevelIndex !== -1) {
                                    const nextLevelConfig = definition.levels[nextLevelIndex];
                                     // Pass the *current* context as the parent context for the next level
                                     // Pass the instanceData generated *for this instance* by the parent's generator
                                    processLevel(nextLevelConfig, currentContext, instanceData);
                                }
                            }); // End forEach instanceData
                        }; // End processLevel function


                        // Start processing from Level 1
                        const level1Config = definition.levels[0];
                        if (level1Config) {
                             // Call processLevel for the root level. No parent context or instance data needed initially.
                            processLevel(level1Config);
                        }

                    } // End if conditionFn matches
                }); // End forEach note
            }); // End forEach block
        }); // End forEach definition

        return allVisualObjects;
    }
}

export default VisualObjectEngine;
export type { MappingContext, NoteContext, InstanceData, ADSRConfig, ADSRConfigFn };
export { MappingUtils, ObjectDefinition }; 