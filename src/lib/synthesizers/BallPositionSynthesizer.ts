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
  
  // Animation state
  private currentPosition: [number, number, number] = [0, 0, 0];
  private targetPosition: [number, number, number] = [0, 0, 0];
  private lastNoteCount: number = 0;
  private animationStartTime: number = 0;

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
      ['animationSpeed', new Property<number>('animationSpeed', 2, {
        uiType: 'slider', label: 'Animation Speed', min: 0.1, max: 10, step: 0.1
      })],
      ['numPositions', new Property<number>('numPositions', 4, {
        uiType: 'slider', label: 'Number of Positions', min: 2, max: 12, step: 1
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

  private generatePositions(numPositions: number): [number, number, number][] {
    const positions: [number, number, number][] = [];
    
    if (numPositions === 2) {
      // Simple left-right
      positions.push([-1, 0, 0], [1, 0, 0]);
    } else if (numPositions === 3) {
      // Left-center-right
      positions.push([-1, 0, 0], [0, 0, 0], [1, 0, 0]);
    } else {
      // For 4+: center, then distribute evenly around
      positions.push([0, 0, 0]); // Always start with center
      
      // Distribute remaining positions in a circle
      for (let i = 1; i < numPositions; i++) {
        const angle = (2 * Math.PI * (i - 1)) / (numPositions - 1);
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        positions.push([x, 0, z]);
      }
    }
    
    return positions;
  }

  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  private easeOutBounce(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }

  private easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  private applyEasing(t: number): number {
    t = Math.min(1, Math.max(0, t)); // Clamp to 0-1
    // Use easeOutQuart as default physics-based curve
    return this.easeOutQuart(t);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpPosition(from: [number, number, number], to: [number, number, number], t: number): [number, number, number] {
    return [
      this.lerp(from[0], to[0], t),
      this.lerp(from[1], to[1], t),
      this.lerp(from[2], to[2], t)
    ];
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    // Count all notes that have started before current time
    let notesThatHaveStarted = 0;
    for (const block of midiBlocks) {
      for (const note of block.notes) {
        if (note.startBeat <= time) {
          notesThatHaveStarted++;
        }
      }
    }

    const xOffset = this.getPropertyValue<number>('xOffset') ?? 5;
    const animationSpeed = this.getPropertyValue<number>('animationSpeed') ?? 2;
    const numPositions = this.getPropertyValue<number>('numPositions') ?? 4;

    // Generate positions dynamically based on current setting
    const currentPositions = this.generatePositions(numPositions);

    // Check if we need to move to a new target position
    if (notesThatHaveStarted !== this.lastNoteCount) {
      this.currentPosition = [...this.targetPosition]; // Set current to where we were going
      
      // Calculate new target position
      const positionIndex = notesThatHaveStarted % currentPositions.length;
      const basePosition = currentPositions[positionIndex];
      this.targetPosition = [
        basePosition[0] * xOffset,
        basePosition[1],
        basePosition[2] * xOffset
      ];
      
      this.lastNoteCount = notesThatHaveStarted;
      this.animationStartTime = time;
      
      console.log(`New note! Moving from [${this.currentPosition}] to [${this.targetPosition}]`);
    }

    // Calculate animation progress (0 to 1)
    const timeSinceAnimation = time - this.animationStartTime;
    const animationDuration = 60 / (bpm * animationSpeed); // Duration in beats
    const linearProgress = timeSinceAnimation / animationDuration;
    
    // Apply physics-based easing curve (easeOutQuart for natural deceleration)
    const easedProgress = this.applyEasing(linearProgress);

    // Interpolate between current and target position using eased progress
    const animatedPosition = this.lerpPosition(this.currentPosition, this.targetPosition, easedProgress);

    return [{
      type: 'sphere',
      sourceNoteId: 'moving-ball',
      properties: {
        position: animatedPosition,
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