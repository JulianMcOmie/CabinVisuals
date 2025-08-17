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
  private lastCNoteCount: number = 0;
  private positionAnimationStartTime: number = 0;
  
  // D note orbit state (45 degree tilt)
  private currentDRotation: number = 0;
  private targetDRotation: number = 0;
  private lastDNoteCount: number = 0;
  private dRotationAnimationStartTime: number = 0;
  
  // E note orbit state (perpendicular, cumulative)
  private currentERotation: number = 0;
  private targetERotation: number = 0;
  private lastENoteCount: number = 0;
  private eRotationAnimationStartTime: number = 0;

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
      ['rotationSpeed', new Property<number>('rotationSpeed', 0.5, {
        uiType: 'slider', label: 'Rotation Speed', min: 0.1, max: 5, step: 0.1
      })],
      ['idleRotationSpeed', new Property<number>('idleRotationSpeed', 0.1, {
        uiType: 'slider', label: 'Idle Rotation Speed', min: 0, max: 1, step: 0.01
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
    // Count C notes (pitch % 12 === 0), D notes (pitch % 12 === 2), and E notes (pitch % 12 === 4)
    let cNotesThatHaveStarted = 0;
    let dNotesThatHaveStarted = 0;
    let eNotesThatHaveStarted = 0;
    let hasAnyCDOrENotes = false;
    
    for (const block of midiBlocks) {
      for (const note of block.notes) {
        const noteClass = note.pitch % 12;
        if (noteClass === 0 || noteClass === 2 || noteClass === 4) { // C, D, or E note exists
          hasAnyCDOrENotes = true;
        }
        
        if (note.startBeat <= time) {
          if (noteClass === 0) { // C note
            cNotesThatHaveStarted++;
          } else if (noteClass === 2) { // D note
            dNotesThatHaveStarted++;
          } else if (noteClass === 4) { // E note
            eNotesThatHaveStarted++;
          }
        }
      }
    }

    // If no C, D, or E notes exist at all, return empty
    if (!hasAnyCDOrENotes) {
      return [];
    }

    const xOffset = this.getPropertyValue<number>('xOffset') ?? 5;
    const animationSpeed = this.getPropertyValue<number>('animationSpeed') ?? 2;
    const rotationSpeed = this.getPropertyValue<number>('rotationSpeed') ?? 1;
    const numPositions = this.getPropertyValue<number>('numPositions') ?? 4;

    // Generate positions dynamically based on current setting
    const currentPositions = this.generatePositions(numPositions);

    // Handle position changes (C notes)
    if (cNotesThatHaveStarted !== this.lastCNoteCount) {
      this.currentPosition = [...this.targetPosition];
      
      const positionIndex = cNotesThatHaveStarted % currentPositions.length;
      const basePosition = currentPositions[positionIndex];
      this.targetPosition = [
        basePosition[0] * xOffset,
        basePosition[1],
        basePosition[2] * xOffset
      ];
      
      this.lastCNoteCount = cNotesThatHaveStarted;
      this.positionAnimationStartTime = time;
      
      console.log(`C note! Moving to position ${positionIndex}`);
    }

    // Handle D note orbit changes (45 degree tilt)
    if (dNotesThatHaveStarted !== this.lastDNoteCount) {
      this.currentDRotation = this.targetDRotation;
      this.targetDRotation += Math.PI * 2; // Full rotation
      
      this.lastDNoteCount = dNotesThatHaveStarted;
      this.dRotationAnimationStartTime = time;
      
      console.log(`D note! Adding orbit rotation`);
    }

    // Handle E note orbit changes (perpendicular, cumulative larger increments)
    if (eNotesThatHaveStarted !== this.lastENoteCount) {
      this.currentERotation = this.targetERotation;
      this.targetERotation += Math.PI / 3; // 60 degree increments (cumulative)
      
      this.lastENoteCount = eNotesThatHaveStarted;
      this.eRotationAnimationStartTime = time;
      
      console.log(`E note! Adding cumulative rotation`);
    }

    // Calculate position animation
    const positionTimeSinceAnimation = time - this.positionAnimationStartTime;
    const positionAnimationDuration = 60 / (bpm * animationSpeed);
    const positionLinearProgress = positionTimeSinceAnimation / positionAnimationDuration;
    const positionEasedProgress = this.applyEasing(positionLinearProgress);
    const animatedPosition = this.lerpPosition(this.currentPosition, this.targetPosition, positionEasedProgress);

    const idleRotationSpeed = this.getPropertyValue<number>('idleRotationSpeed') ?? 0.1;

    // Calculate D note orbit animation (45 degree tilt) with idle rotation
    const dRotationTimeSinceAnimation = time - this.dRotationAnimationStartTime;
    const dRotationAnimationDuration = 60 / (bpm * rotationSpeed);
    const dRotationLinearProgress = dRotationTimeSinceAnimation / dRotationAnimationDuration;
    const dRotationEasedProgress = this.applyEasing(dRotationLinearProgress);
    const animatedDRotation = this.lerp(this.currentDRotation, this.targetDRotation, dRotationEasedProgress) + 
                              (time * idleRotationSpeed); // Add continuous idle rotation

    // Calculate E note orbit animation (perpendicular, very fast) with idle rotation
    const eRotationTimeSinceAnimation = time - this.eRotationAnimationStartTime;
    const eRotationAnimationDuration = 0.1; // Very small animation time (0.1 beats)
    const eRotationLinearProgress = eRotationTimeSinceAnimation / eRotationAnimationDuration;
    const eRotationEasedProgress = this.applyEasing(eRotationLinearProgress);
    const animatedERotation = this.lerp(this.currentERotation, this.targetERotation, eRotationEasedProgress) + 
                              (time * idleRotationSpeed * 0.7); // Add continuous idle rotation (slightly slower)

    // Calculate D orb position (45 degree tilt around main sphere)
    const dOrbitDistance = 1.5;
    const tilt = Math.PI / 4; // 45 degrees
    const dOrbX = animatedPosition[0] + Math.cos(animatedDRotation) * dOrbitDistance * Math.cos(tilt);
    const dOrbY = animatedPosition[1] + Math.sin(animatedDRotation) * dOrbitDistance * Math.sin(tilt);
    const dOrbZ = animatedPosition[2] + Math.sin(animatedDRotation) * dOrbitDistance * Math.cos(tilt);

    // Calculate E orb position (45 degree tilt perpendicular to D orb, further out)
    const eOrbitDistance = 2.2; // Further out than D orb
    const eTilt = Math.PI / 4; // 45 degrees, perpendicular to D orb
    const eOrbX = animatedPosition[0] + Math.sin(animatedERotation) * eOrbitDistance * Math.cos(eTilt);
    const eOrbY = animatedPosition[1] + Math.cos(animatedERotation) * eOrbitDistance * Math.sin(eTilt);
    const eOrbZ = animatedPosition[2] + Math.cos(animatedERotation) * eOrbitDistance * Math.cos(eTilt);

    const visuals: VisualObject[] = [
      // Main ball
      {
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
      }
    ];

    // Add D orb if D notes exist
    if (dNotesThatHaveStarted > 0) {
      visuals.push({
        type: 'sphere',
        sourceNoteId: 'd-orbiting-satellite',
        properties: {
          position: [dOrbX, dOrbY, dOrbZ] as [number, number, number],
          scale: [0.4, 0.4, 0.4],
          color: '#ff9900',
          opacity: 1,
          emissive: '#ff9900',
          emissiveIntensity: 1.5
        }
      });
    }

    // Add E orb if E notes exist
    if (eNotesThatHaveStarted > 0) {
      visuals.push({
        type: 'sphere',
        sourceNoteId: 'e-orbiting-satellite',
        properties: {
          position: [eOrbX, eOrbY, eOrbZ] as [number, number, number],
          scale: [0.4, 0.4, 0.4],
          color: '#0066ff',
          opacity: 1,
          emissive: '#0066ff',
          emissiveIntensity: 1.5
        }
      });
    }

    return visuals;
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