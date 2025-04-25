import { MIDINote, MIDIBlock, VisualObject } from './types';
import Synthesizer from './Synthesizer'; // Assuming Synthesizer provides getPropertyValue
import { PhysicsUtils } from './PhysicsUtils'; // Import PhysicsUtils

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

// --- NEW: Approach Envelope Config ---
interface ApproachEnvelopeConfig {
    lookaheadTime: number; // Seconds before note start to begin appearing
    // We don't need approachSpeed here, it will be handled by the mapper using timeUntilNoteStart
}
type ApproachEnvelopeConfigFn = (noteCtx: NoteContext) => ApproachEnvelopeConfig;
// --- END NEW ---

// Define the physics envelope configuration
interface PhysicsEnvelopeConfig {
  tension?: number; // Spring stiffness
  friction?: number; // Damping
  initialVelocity?: number; // Initial impulse
}

type PhysicsEnvelopeConfigFn = (noteCtx: NoteContext) => PhysicsEnvelopeConfig;

interface MappingContext {
  note: MIDINote;
  time: number; // Current global time (beats)
  bpm: number;
  noteAbsoluteStartBeat: number; // Absolute start beat of the triggering note
  timeSinceNoteStart: number; // Seconds (>= 0 during note, < 0 during approach)
  noteProgressPercent: number; // 0-1 (only valid >= 0)
  noteDurationSeconds: number;
  level: number; // Nesting depth (1 = initial)
  instanceData: InstanceData; // Data from .forEachInstance generator
  parentContext?: MappingContext; // Context of the parent
  adsrAmplitude?: number; // Current ADSR amplitude (0-1)
  adsrPhase?: 'attack' | 'decay' | 'sustain' | 'release' | 'idle'; // Current ADSR phase
  physicsValue?: number; // Current value from physics envelope
  calculatedProperties?: VisualObjectProperties; // Read-only view of properties calculated so far
  timeUntilNoteStart?: number; // --- NEW: Seconds until the note starts (only present during approach phase) ---
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
    physicsEnvelopeConfig?: PhysicsEnvelopeConfig | PhysicsEnvelopeConfigFn; // Physics envelope for this level
    approachEnvelopeConfig?: ApproachEnvelopeConfig | ApproachEnvelopeConfigFn; // --- NEW: Approach envelope for this level ---
}


// --- Object Definition ---

class ObjectDefinition {
    private engine: VisualObjectEngine;
    private synthesizer: Synthesizer; // Reference to the synthesizer for property access
    initialType: string;
    conditionFn: ConditionFn = () => true; // Default: always execute
    levels: DefinitionLevel[] = []; // Stores config for each nesting level
    // --- NEW: Add top-level approach config storage ---
    // This applies *before* the first level processing starts
    approachEnvelopeConfig?: ApproachEnvelopeConfig | ApproachEnvelopeConfigFn; 
    // --- END NEW ---

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

    applyApproachEnvelope(config: ApproachEnvelopeConfig | ApproachEnvelopeConfigFn): this {
        // Store it at the top level of the definition
        this.approachEnvelopeConfig = config; 
        // We could potentially also store it on the *current level* like other modifiers,
        // but applying it globally to the trigger seems more intuitive for this feature.
        // If level-specific approach timing is needed later, this could be revisited.
        // this.getCurrentLevelConfig().approachEnvelopeConfig = config;
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

    applyPhysicsEnvelope(config: PhysicsEnvelopeConfig | PhysicsEnvelopeConfigFn): this {
        this.getCurrentLevelConfig().physicsEnvelopeConfig = config;
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
        const currentTimeSec = time * secondsPerBeat;

        const DEFAULT_TENSION = 100;
        const DEFAULT_FRICTION = 10;
        const DEFAULT_INITIAL_VELOCITY = 1;

        this.objectDefinitions.forEach(definition => {
            midiBlocks.forEach(block => {
                const blockAbsoluteStartBeat = block.startBeat;

                block.notes.forEach(note => {
                    const noteAbsoluteStartBeat = blockAbsoluteStartBeat + note.startBeat;
                    const noteAbsoluteEndBeat = noteAbsoluteStartBeat + note.duration;
                    const noteDurationSeconds = note.duration * secondsPerBeat;
                    const noteStartSec = noteAbsoluteStartBeat * secondsPerBeat;
                    const noteEndSec = noteAbsoluteEndBeat * secondsPerBeat;

                    const noteCtx: NoteContext = { note };

                    // --- MODIFIED: Check condition and approach/active state ---
                    if (definition.conditionFn.call(this.synthesizer, noteCtx)) {

                        let isDuringApproach = false;
                        let timeUntilNoteStart: number | undefined = undefined;
                        let currentApproachConfig: ApproachEnvelopeConfig | undefined = undefined;

                        // Check for Approach Envelope first
                        if (definition.approachEnvelopeConfig) {
                            currentApproachConfig = typeof definition.approachEnvelopeConfig === 'function'
                                ? definition.approachEnvelopeConfig.call(this.synthesizer, noteCtx)
                                : definition.approachEnvelopeConfig;
                            
                            const lookaheadTime = currentApproachConfig.lookaheadTime ?? 0;
                            const approachStartSec = noteStartSec - lookaheadTime;

                            if (lookaheadTime > 0 && currentTimeSec >= approachStartSec && currentTimeSec < noteStartSec) {
                                isDuringApproach = true;
                                timeUntilNoteStart = noteStartSec - currentTimeSec;
                            }
                        }

                        // Determine max release time needed for this note based on all levels
                        let maxReleaseTime = 0;
                        definition.levels.forEach(levelConfig => {
                            if (levelConfig.adsrConfig) {
                                const config = typeof levelConfig.adsrConfig === 'function'
                                    ? levelConfig.adsrConfig.call(this.synthesizer, noteCtx)
                                    : levelConfig.adsrConfig;
                                maxReleaseTime = Math.max(maxReleaseTime, config.release ?? 0);
                            }
                        });

                        // Check if the note is active OR if we are within the release window
                        const isActiveNote = currentTimeSec >= noteStartSec && currentTimeSec < noteEndSec;
                        const isDuringRelease = currentTimeSec >= noteEndSec && currentTimeSec < (noteEndSec + maxReleaseTime);

                        // Proceed if in approach, active, or release phase
                        if (isDuringApproach || isActiveNote || isDuringRelease) {
                        // --- END MODIFIED ---

                            // Recursive function to process levels (Mostly unchanged, but context creation needs update)
                            const processLevel = (
                                levelConfig: DefinitionLevel,
                                parentContext?: MappingContext,
                                parentInstanceData?: InstanceData
                            ): void => {
                                const instancesData: InstanceData[] = [];
                                if (levelConfig.level === 1) {
                                    instancesData.push(parentInstanceData ?? {}); 
                                } else if (levelConfig.generatorFn && parentContext) {
                                    const generatedData = levelConfig.generatorFn.call(this.synthesizer, parentContext);
                                    instancesData.push(...generatedData);
                                } else if (!parentContext && levelConfig.level > 1) {
                                    console.warn("Generator function called without parent context for level > 1");
                                    return; 
                                } else {
                                     return;
                                }


                                instancesData.forEach(instanceData => {
                                    // --- MODIFIED: Calculate time context ---
                                    // timeSinceNoteStart is now potentially negative during approach
                                    const timeSinceNoteStart = currentTimeSec - noteStartSec; 
                                    // noteProgressPercent is only valid during the actual note duration
                                    const noteProgressPercent = isActiveNote && noteDurationSeconds > 0 
                                        ? Math.min(1, Math.max(0, timeSinceNoteStart / noteDurationSeconds)) 
                                        : (isDuringApproach ? 0 : 1); // 0 before note, 1 after note (if duration is 0)
                                    // --- END MODIFIED ---

                                    // --- ADSR Calculation --- 
                                    // (Needs adjustment? ADSR usually starts at note time, not during approach)
                                    // Current logic calculates based on noteStartSec, so it should naturally be 0 amplitude during approach.
                                    let adsrAmplitude: number | undefined = undefined;
                                    let adsrPhase: 'attack' | 'decay' | 'sustain' | 'release' | 'idle' | undefined = undefined;
                                    if (levelConfig.adsrConfig) {
                                        const currentAdsrConfig = typeof levelConfig.adsrConfig === 'function'
                                            ? levelConfig.adsrConfig.call(this.synthesizer, noteCtx)
                                            : levelConfig.adsrConfig;
                                        const adsrResult = this.calculateADSR(time, noteAbsoluteStartBeat, noteAbsoluteEndBeat, bpm, currentAdsrConfig);
                                        adsrAmplitude = adsrResult.amplitude;
                                        adsrPhase = adsrResult.phase;
                                    }

                                    // --- Physics Envelope Calculation ---
                                    // (Current logic iterates all past notes, should be fine?)
                                    // Physics is based on time *since* the contributing note started, so approach phase shouldn't affect it directly.
                                    let cumulativePhysicsValue: number = 0;
                                    if (levelConfig.physicsEnvelopeConfig) {
                                        const physicsConfigProvider = levelConfig.physicsEnvelopeConfig;
                                        midiBlocks.forEach(blockP => {
                                            const blockAbsStartBeatP = blockP.startBeat;
                                            blockP.notes.forEach(contributingNote => {
                                                const contributingNoteCtx: NoteContext = { note: contributingNote };
                                                if (definition.conditionFn.call(this.synthesizer, contributingNoteCtx)) {
                                                    const contribNoteAbsStartBeat = blockAbsStartBeatP + contributingNote.startBeat;
                                                    if (contribNoteAbsStartBeat <= time) { // Only past/present notes
                                                        const timeSinceContribNoteStart = Math.max(0, (time - contribNoteAbsStartBeat) * secondsPerBeat);
                                                        const currentPhysicsConfig = typeof physicsConfigProvider === 'function'
                                                            ? physicsConfigProvider.call(this.synthesizer, contributingNoteCtx)
                                                            : physicsConfigProvider;

                                                        const tension = currentPhysicsConfig?.tension ?? DEFAULT_TENSION;
                                                        const friction = currentPhysicsConfig?.friction ?? DEFAULT_FRICTION;
                                                        let initialVelocity = currentPhysicsConfig?.initialVelocity ?? DEFAULT_INITIAL_VELOCITY;
                                                       
                                                        const scaleVelocity = true; 
                                                        if (scaleVelocity && contributingNote.velocity !== undefined) { 
                                                           initialVelocity *= MappingUtils.mapValue(contributingNote.velocity, 0, 127, 0.2, 1.8); 
                                                        }
                                                        
                                                        if (!(timeSinceContribNoteStart <= 0 && initialVelocity === 0)) {
                                                            const contribution = PhysicsUtils.calculateDampedOscillator(
                                                                timeSinceContribNoteStart, tension, friction, initialVelocity
                                                            );
                                                            cumulativePhysicsValue += contribution;
                                                        }
                                                    }
                                                }
                                            }); 
                                        }); 
                                    }
                                    const physicsValue = cumulativePhysicsValue;


                                    // --- MODIFIED: Early exit needs to consider approach phase ---
                                    // If we are in the approach phase, we generally don't want to exit early,
                                    // unless specifically designed (e.g., opacity mapper maps to 0).
                                    // Let's disable early exit during the approach phase for now.
                                    // A more nuanced approach might be needed later.
                                    if (!isDuringApproach) {
                                        const isAdsrIdle = adsrAmplitude !== undefined && adsrAmplitude <= 0 && adsrPhase === 'idle';
                                        const isPhysicsSettled = Math.abs(physicsValue) < 0.001; 
                                        if (levelConfig.adsrConfig && isAdsrIdle && levelConfig.physicsEnvelopeConfig && isPhysicsSettled) {
                                            return; 
                                        }
                                        if (levelConfig.adsrConfig && !levelConfig.physicsEnvelopeConfig && isAdsrIdle) {
                                            return; 
                                        }
                                    }
                                    // --- END MODIFIED ---


                                    // --- MODIFIED: Create Mapping Context ---
                                    const currentContext: MappingContext = {
                                        note: note,
                                        time: time,
                                        bpm: bpm,
                                        noteAbsoluteStartBeat: noteAbsoluteStartBeat,
                                        timeSinceNoteStart: timeSinceNoteStart, // Can be negative now
                                        noteProgressPercent: noteProgressPercent, // 0 during approach
                                        noteDurationSeconds: noteDurationSeconds,
                                        level: levelConfig.level,
                                        instanceData: instanceData,
                                        parentContext: parentContext,
                                        adsrAmplitude: adsrAmplitude,
                                        adsrPhase: adsrPhase,
                                        physicsValue: physicsValue,
                                        timeUntilNoteStart: timeUntilNoteStart // Add the new property
                                        // calculatedProperties filled below
                                    };
                                    // --- END MODIFIED ---

                                    // --- Apply Mappers (Unchanged) ---
                                    const calculatedProps: VisualObjectProperties = {};
                                    if (levelConfig.positionMapper) calculatedProps.position = levelConfig.positionMapper.call(this.synthesizer, currentContext);
                                    if (levelConfig.scaleMapper) calculatedProps.scale = levelConfig.scaleMapper.call(this.synthesizer, currentContext);
                                    if (levelConfig.rotationMapper) calculatedProps.rotation = levelConfig.rotationMapper.call(this.synthesizer, currentContext);
                                    if (levelConfig.colorMapper) calculatedProps.color = levelConfig.colorMapper.call(this.synthesizer, currentContext);
                                    if (levelConfig.opacityMapper) calculatedProps.opacity = levelConfig.opacityMapper.call(this.synthesizer, currentContext);


                                    currentContext.calculatedProperties = calculatedProps;

                                    const objectType = levelConfig.type ?? (parentContext?.calculatedProperties as any)?.type ?? definition.initialType;

                                    // --- Create Visual Object (Unchanged structure, but check opacity) ---
                                    // Add a check: if opacity is effectively zero, maybe don't create the object?
                                    const finalOpacity = calculatedProps.opacity ?? 1; 
                                    if (finalOpacity > 0.001 && (calculatedProps.position || calculatedProps.scale)) { // Only create if visible and has geometry
                                         const visualObject: VisualObject = {
                                             type: objectType,
                                             properties: {
                                                 position: calculatedProps.position ?? [0, 0, 0],
                                                 scale: typeof calculatedProps.scale === 'number'
                                                           ? [calculatedProps.scale, calculatedProps.scale, calculatedProps.scale]
                                                           : calculatedProps.scale ?? [1, 1, 1],
                                                 rotation: calculatedProps.rotation ?? [0, 0, 0],
                                                 color: calculatedProps.color ?? '#ffffff',
                                                 opacity: finalOpacity, // Use potentially calculated opacity
                                             },
                                             // id: `${block.id}-${note.id}-${note.pitch}-${levelConfig.level}-${isDuringApproach ? 'approach' : 'active'}` // REMOVED id property
                                             // sourceNoteId is added conditionally below
                                         };
                                         // Add sourceNoteId if note has an id
                                         if (note.id) {
                                            visualObject.sourceNoteId = note.id;
                                         }
                                         allVisualObjects.push(visualObject);
                                    }


                                    // --- Recurse for Next Level (Unchanged) ---
                                    const nextLevelIndex = definition.levels.findIndex(l => l.level === levelConfig.level + 1);
                                    if (nextLevelIndex !== -1) {
                                        const nextLevelConfig = definition.levels[nextLevelIndex];
                                        processLevel(nextLevelConfig, currentContext, instanceData);
                                    }
                                }); // End forEach instanceData
                            }; // End processLevel function


                            // Start processing from Level 1
                            const level1Config = definition.levels[0];
                            if (level1Config) {
                                processLevel(level1Config);
                            }

                        } // End if (isDuringApproach || isActiveNote || isDuringRelease)
                    } // End if conditionFn matches
                }); // End forEach note
            }); // End forEach block
        }); // End forEach definition

        return allVisualObjects;
    }
}

export default VisualObjectEngine;
export type { MappingContext, NoteContext, InstanceData, ADSRConfig, ADSRConfigFn, PhysicsEnvelopeConfig, PhysicsEnvelopeConfigFn, ApproachEnvelopeConfig, ApproachEnvelopeConfigFn }; // Export new types
export { MappingUtils, ObjectDefinition }; 