import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property, PropertyMetadata } from '../properties/Property'; // Import PropertyMetadata
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext, InstanceData } from '../VisualObjectEngine';
import * as THREE from 'three'; // Import THREE for vector math

class RadialDrumSynth extends Synthesizer {

    constructor() {
        super();
        this.initializeProperties();
        this.engine = new VisualObjectEngine(this); // Instantiate the engine
        this.initializeEngine(); // Define engine logic
    }

    // Define configurable properties
    protected initializeProperties(): void {
        // Use Property with numeric metadata for movementSpeed
        this.properties.set('movementSpeed', new Property<number>(
            'movementSpeed',
            5,
            { label: 'Movement Speed', uiType: 'slider', min: 0.1, max: 20, step: 0.1 }
        ));
        // Use Property with color metadata for color
        this.properties.set('color', new Property<string>(
            'color',
            '#ffffff',
            { label: 'Color', uiType: 'color' }
        ));
        // Temporarily remove targetTrackName property due to unclear uiType
        // this.properties.set('targetTrackName', new Property<string>('Target Track Name', 'Drums', { label: 'Target Track Name', uiType: 'text' })); 
    }

    // Define the visualization logic using the engine
    protected initializeEngine(): void {
        // Removed TARGET_TRACK constant as property is removed
        // const TARGET_TRACK = this.getPropertyValue<string>('targetTrackName') ?? 'Drums';

        this.engine.defineObject('cube') // Base object type is cube
            .when((noteCtx: NoteContext): boolean => {
                // Trigger only for notes on the specified track
                // TODO: Need access to track name or ID. Assuming synthesizer context provides it.
                // This is a placeholder - requires Synthesizer base class or context to provide track info
                // const trackName = this.getTrackNameForNote(noteCtx.note); // Hypothetical method
                // return trackName === TARGET_TRACK; 
                return true; // TEMPORARY: Trigger for all notes until track filtering is implemented
            })
            .forEachInstance((parentCtx: MappingContext): InstanceData[] => {
                // Generate 4 instances, one for each direction
                return [
                    { direction: new THREE.Vector3(1, 0, 0), id: 'px' }, // Positive X
                    { direction: new THREE.Vector3(-1, 0, 0), id: 'nx' }, // Negative X
                    { direction: new THREE.Vector3(0, 1, 0), id: 'py' }, // Positive Y
                    { direction: new THREE.Vector3(0, -1, 0), id: 'ny' }  // Negative Y
                ];
            })
            .withPosition((ctx: MappingContext): [number, number, number] => {
                const direction = ctx.instanceData.direction as THREE.Vector3;
                // Read speed directly from properties within the mapper
                const speed = this.getPropertyValue<number>('movementSpeed') ?? 5;
                const distance = speed * ctx.timeSinceNoteStart;
                const pos = direction.clone().multiplyScalar(distance);
                return [pos.x, pos.y, pos.z];
            })
            .withColor((ctx: MappingContext): string => {
                 // Read color directly from properties within the mapper
                 return this.getPropertyValue<string>('color') ?? '#ffffff';
            });
            // No .withOpacity() or .applyADSR() needed, lifespan is tied to note duration
    }

    // Delegate object generation to the engine
    getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
         // Update speed property in case it changed via UI
         // (Alternative: Re-initialize engine if properties change significantly)
         // For now, we read it directly in the mapper.
        return this.engine.getObjectsAtTime(time, midiBlocks, bpm);
    }

    // Required clone method
    clone(): this {
        const newInstance = new (this.constructor as any)(); // Create new instance of the same class
        // Copy properties
        this.properties.forEach((value, key) => {
            newInstance.setPropertyValue(key, value.value); // Copy current value
        });
        return newInstance;
    }

    // --- Helper Methods (Example: Needs implementation in base or here) ---
    // private getTrackNameForNote(note: MIDINote): string | undefined {
    //     // Find the track associated with this note (needs access to track data)
    //     // This logic depends on how tracks and notes are linked in your application state
    //     console.warn("getTrackNameForNote is not implemented!");
    //     return undefined; 
    // }
}

export default RadialDrumSynth; 