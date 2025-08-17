import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

class BallPositionSynthesizer extends Synthesizer {
  private activeBallPositions: Map<string, number> = new Map();
  private globalNoteCount: number = 0;
  private positions: [number, number, number][] = [
    [0, 0, 0],    // center
    [-1, 0, 0],   // left
    [0, 0, 0],    // center  
    [1, 0, 0]     // right
  ];

  constructor() {
    super();
    this.initializeProperties();
    this.engine = new VisualObjectEngine(this);
    this.initializeEngine();
  }

  private initializeProperties(): void {
    this.properties = new Map<string, Property<any>>([
      ['ballSize', new Property<number>('ballSize', 2, {
        uiType: 'slider', label: 'Ball Size', min: 0.1, max: 10, step: 0.1
      })],
      ['xOffset', new Property<number>('xOffset', 5, {
        uiType: 'slider', label: 'X Offset', min: 1, max: 20, step: 0.5
      })],
      ['attack', new Property<number>('attack', 0.05, {
        uiType: 'slider', label: 'Attack (s)', min: 0.001, max: 2, step: 0.001
      })],
      ['decay', new Property<number>('decay', 0.3, {
        uiType: 'slider', label: 'Decay (s)', min: 0.001, max: 2, step: 0.001
      })],
      ['sustain', new Property<number>('sustain', 0.5, {
        uiType: 'slider', label: 'Sustain Level', min: 0, max: 1, step: 0.01
      })],
      ['release', new Property<number>('release', 0.4, {
        uiType: 'slider', label: 'Release (s)', min: 0.001, max: 5, step: 0.001
      })],
    ]);
  }

  private initializeEngine(): void {
    this.engine.defineObject('sphere')
      .applyADSR((noteCtx: NoteContext) => ({
        attack: this.getPropertyValue<number>('attack') ?? 0.05,
        decay: this.getPropertyValue<number>('decay') ?? 0.3,
        sustain: this.getPropertyValue<number>('sustain') ?? 0.5,
        release: this.getPropertyValue<number>('release') ?? 0.4,
      }))
      .withPosition((ctx: MappingContext) => {
        const xOffset = this.getPropertyValue<number>('xOffset') ?? 5;
        
        // Create unique key for this note
        const noteKey = `${ctx.note.startBeat}_${ctx.note.pitch}`;
        
        // Get or assign position for this note
        if (!this.activeBallPositions.has(noteKey)) {
          const positionIndex = this.globalNoteCount % this.positions.length;
          this.activeBallPositions.set(noteKey, positionIndex);
          this.globalNoteCount++;
        }
        
        const positionIndex = this.activeBallPositions.get(noteKey)!;
        const basePosition = this.positions[positionIndex];
        
        // Scale the x position by the offset
        return [
          basePosition[0] * xOffset,
          basePosition[1],
          basePosition[2]
        ];
      })
      .withScale((ctx: MappingContext) => {
        const ballSize = this.getPropertyValue<number>('ballSize') ?? 2;
        const amplitude = ctx.adsrAmplitude ?? 1;
        const size = ballSize * (ctx.note.velocity / 127) * amplitude;
        
        return [size, size, size];
      })
      .withColor((ctx: MappingContext) => {
        const noteKey = `${ctx.note.startBeat}_${ctx.note.pitch}`;
        const positionIndex = this.activeBallPositions.get(noteKey) ?? 0;
        const hues = [60, 240, 120, 0]; // yellow, blue, green, red for center, left, center, right
        const hue = hues[positionIndex];
        
        return `hsl(${hue}, 80%, 60%)`;
      })
      .withOpacity((ctx: MappingContext) => ctx.adsrAmplitude ?? 1);
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    // Count all notes that have started before current time
    let notesThatHaveStarted = 0;
    for (const block of midiBlocks) {
      for (const note of block.notes) {
        console.log(`Note startBeat: ${note.startBeat}, current time: ${time}, started: ${note.startBeat <= time}`);
        if (note.startBeat <= time) {
          notesThatHaveStarted++;
        }
      }
    }

    // Use math to determine position: center(0) → left(1) → center(2) → right(3)
    const positionIndex = notesThatHaveStarted % this.positions.length;
    console.log(`notesThatHaveStarted: ${notesThatHaveStarted}, positionIndex: ${positionIndex}`);
    const currentPosition = this.positions[positionIndex];
    const xOffset = this.getPropertyValue<number>('xOffset') ?? 5;
    
    // Apply offset to x position
    const finalPosition: [number, number, number] = [
      currentPosition[0] * xOffset,
      currentPosition[1],
      currentPosition[2]
    ];

    return [{
      type: 'sphere',
      sourceNoteId: 'moving-ball',
      properties: {
        position: finalPosition,
        scale: [2, 2, 2],
        color: '#ff6600',
        opacity: 1,
        emissive: '#ff6600',
        emissiveIntensity: 1
      }
    }];
  }

  clone(): this {
    const cloned = new BallPositionSynthesizer() as this;

    this.properties.forEach((property, name) => {
      const clonedProperty = cloned.properties.get(name);
      if (clonedProperty) {
        clonedProperty.value = property.value;
      }
    });

    return cloned;
  }
}

export default BallPositionSynthesizer;