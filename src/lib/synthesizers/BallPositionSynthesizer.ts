import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject, MIDINote } from '../types';
import { Property } from '../properties/Property';
import VisualObjectEngine, { MappingContext, MappingUtils, NoteContext } from '../VisualObjectEngine';

interface TrailPoint {
  position: [number, number, number];
  timestamp: number;
  age: number; // 0 to 1, where 1 is fully faded
  rotation?: number; // Store the actual rotation angle for orbital trails
}


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
  
  // F note orbit state (further out, pink orb, larger increments)
  private currentFRotation: number = 0;
  private targetFRotation: number = 0;
  private lastFNoteCount: number = 0;
  private fRotationAnimationStartTime: number = 0;

  // Trail tracking
  private mainBallTrail: TrailPoint[] = [];
  private dOrbTrail: TrailPoint[] = [];
  private eOrbTrail: TrailPoint[] = [];
  private fOrbTrail: TrailPoint[] = [];

  // Arc effect positions (frozen at time of change)
  private arcCenterPosition: [number, number, number] = [0, 0, 0];
  private arcDRotation: number = 0;
  private arcERotation: number = 0;
  private arcFRotation: number = 0;

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
      ['trailLength', new Property<number>('trailLength', 50, {
        uiType: 'slider', label: 'Trail Length', min: 10, max: 100, step: 1
      })],
      ['trailFadeTime', new Property<number>('trailFadeTime', 1.0, {
        uiType: 'slider', label: 'Trail Fade Time (s)', min: 0.2, max: 3.0, step: 0.1
      })],
      ['trailEnabled', new Property<boolean>('trailEnabled', true, {
        uiType: 'dropdown', label: 'Enable Trails', options: [
          { value: true, label: 'Enabled' },
          { value: false, label: 'Disabled' }
        ]
      })],
      ['arcEnabled', new Property<boolean>('arcEnabled', true, {
        uiType: 'dropdown', label: 'Enable Arc Effects', options: [
          { value: true, label: 'Enabled' },
          { value: false, label: 'Disabled' }
        ]
      })],
      ['arcLength', new Property<number>('arcLength', 2.0, {
        uiType: 'slider', label: 'Arc Length (radians)', min: 0.5, max: 4.0, step: 0.1
      })],
      ['arcDensity', new Property<number>('arcDensity', 20, {
        uiType: 'slider', label: 'Arc Density', min: 10, max: 50, step: 1
      })],
      ['arcFadeTime', new Property<number>('arcFadeTime', 1.0, {
        uiType: 'slider', label: 'Arc Fade Time (s)', min: 0.2, max: 3.0, step: 0.1
      })],
      ['arcRadiusMultiplier', new Property<number>('arcRadiusMultiplier', 2.0, {
        uiType: 'slider', label: 'Arc Radius Multiplier', min: 1.0, max: 5.0, step: 0.1
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

  private updateTrailWithRotation(trail: TrailPoint[], currentPos: [number, number, number], currentTime: number, fadeTime: number, maxLength: number, centerPos: [number, number, number], orbitDistance: number, tilt: number, currentRotation: number, orbitType: 'main' | 'd' | 'e' | 'f'): void {
    // If we have a previous position, interpolate along the orbital arc using actual rotation values
    if (trail.length > 0 && trail[0].rotation !== undefined) {
      const lastTime = trail[0].timestamp;
      const lastRotation = trail[0].rotation!;
      const timeDiff = currentTime - lastTime;
      
      // Calculate rotational distance moved (speed-based density)
      let rotationDiff = currentRotation - lastRotation;
      
      // Handle angle wrapping (shortest path between angles)
      if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
      if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
      
      const rotationalDistance = Math.abs(rotationDiff);
      
      // Only interpolate if there's significant rotation
      if (rotationalDistance > 0.02 && timeDiff > 0.01) {
        // Base interpolation on rotational distance (angular speed)
        // More rotation = more trail points for consistent density
        const interpolationSteps = Math.max(1, Math.min(25, Math.floor(rotationalDistance * 15))); // 15 points per radian
        
        for (let i = 1; i <= interpolationSteps; i++) {
          const t = i / interpolationSteps;
          const interpolatedTime = this.lerp(lastTime, currentTime, t);
          const interpolatedRotation = lastRotation + (rotationDiff * t);
          
          // Calculate position on the orbital arc using the interpolated rotation
          const interpolatedPos = this.calculateOrbitPosition(centerPos, orbitDistance, interpolatedRotation, tilt, orbitType);
          
          trail.unshift({
            position: interpolatedPos,
            timestamp: interpolatedTime,
            rotation: interpolatedRotation,
            age: 0
          });
        }
      }
    } else {
      // First position or fallback - just add it with rotation
      trail.unshift({
        position: [...currentPos] as [number, number, number],
        timestamp: currentTime,
        rotation: currentRotation,
        age: 0
      });
    }

    // Update ages and remove old points
    for (let i = trail.length - 1; i >= 0; i--) {
      const point = trail[i];
      const timeDiff = currentTime - point.timestamp;
      point.age = Math.min(1, timeDiff / fadeTime);
      
      if (point.age >= 1 || i >= maxLength) {
        trail.splice(i, 1);
      }
    }
  }

  private calculateOrbitAngle(pos: [number, number, number], center: [number, number, number], distance: number, tilt: number, orbitType: 'main' | 'd' | 'e' | 'f'): number {
    const relativePos = [pos[0] - center[0], pos[1] - center[1], pos[2] - center[2]];
    
    switch (orbitType) {
      case 'main': // Main ball horizontal orbit
        return Math.atan2(relativePos[2], relativePos[0]);
      case 'd': // D orb: 45 degree tilt around X axis
        return Math.atan2(relativePos[2] * Math.cos(tilt) + relativePos[1] * Math.sin(tilt), relativePos[0]);
      case 'e': // E orb: uses sin for X, cos for Y - perpendicular to D
        return Math.atan2(relativePos[2], relativePos[1]);
      case 'f': // F orb: cos for X, sin for Y in horizontal plane
        return Math.atan2(relativePos[2] * Math.sin(tilt), relativePos[0] * Math.cos(tilt));
      default:
        return Math.atan2(relativePos[2], relativePos[0]);
    }
  }

  private calculateOrbitPosition(center: [number, number, number], distance: number, angle: number, tilt: number, orbitType: 'main' | 'd' | 'e' | 'f'): [number, number, number] {
    switch (orbitType) {
      case 'main': // Main ball horizontal orbit
        return [
          center[0] + Math.cos(angle) * distance,
          center[1],
          center[2] + Math.sin(angle) * distance
        ];
      case 'd': // D orb: matches actual calculation
        return [
          center[0] + Math.cos(angle) * distance * Math.cos(tilt),
          center[1] + Math.sin(angle) * distance * Math.sin(tilt),
          center[2] + Math.sin(angle) * distance * Math.cos(tilt)
        ];
      case 'e': // E orb: matches actual calculation (sin for X, cos for Y)
        return [
          center[0] + Math.sin(angle) * distance * Math.cos(tilt),
          center[1] + Math.cos(angle) * distance * Math.sin(tilt),
          center[2] + Math.cos(angle) * distance * Math.cos(tilt)
        ];
      case 'f': // F orb: matches actual calculation
        return [
          center[0] + Math.cos(angle) * distance * Math.cos(tilt),
          center[1] + Math.sin(angle) * distance,
          center[2] + Math.sin(angle) * distance * Math.sin(tilt)
        ];
      default:
        return [
          center[0] + Math.cos(angle) * distance,
          center[1],
          center[2] + Math.sin(angle) * distance
        ];
    }
  }

  private updateTrail(trail: TrailPoint[], currentPos: [number, number, number], currentTime: number, fadeTime: number, maxLength: number): void {
    // Simple linear interpolation fallback for non-orbital trails
    trail.unshift({
      position: [...currentPos] as [number, number, number],
      timestamp: currentTime,
      age: 0
    });

    // Update ages and remove old points
    for (let i = trail.length - 1; i >= 0; i--) {
      const point = trail[i];
      const timeDiff = currentTime - point.timestamp;
      point.age = Math.min(1, timeDiff / fadeTime);
      
      if (point.age >= 1 || i >= maxLength) {
        trail.splice(i, 1);
      }
    }
  }

  private addTrailVisuals(visuals: VisualObject[], trail: TrailPoint[], baseColor: string, trailId: string, isMainBall: boolean = false): void {
    trail.forEach((point, index) => {
      const opacity = (1 - point.age) * 0.8; // Fade from 0.8 to 0
      const scale = isMainBall 
        ? (1 - point.age) * 0.8  // Bigger spheres for main ball (0.8 vs 0.2)
        : (1 - point.age) * 0.2; // Smaller for orbs
      
      if (opacity > 0.01) { // Only render if visible
        visuals.push({
          type: 'sphere',
          sourceNoteId: `${trailId}-${index}`,
          properties: {
            position: point.position,
            scale: [scale, scale, scale],
            color: baseColor,
            opacity: opacity,
            emissive: baseColor,
            emissiveIntensity: opacity * 2
          }
        });
      }
    });
  }

  private addOrbitalArcVisuals(
    visuals: VisualObject[], 
    centerPos: [number, number, number], 
    changeRotation: number, 
    orbitDistance: number, 
    tilt: number, 
    orbitType: 'main' | 'd' | 'e' | 'f',
    color: string,
    lastNoteChangeTime: number,
    time: number
  ): void {
    if (!this.getPropertyValue<boolean>('arcEnabled')) return;
    
    const arcLength = this.getPropertyValue<number>('arcLength') ?? 2.0;
    const arcDensity = this.getPropertyValue<number>('arcDensity') ?? 20;
    const arcFadeTime = this.getPropertyValue<number>('arcFadeTime') ?? 1.0;
    const arcRadiusMultiplier = this.getPropertyValue<number>('arcRadiusMultiplier') ?? 2.0;
    
    // Time since the last movement
    const timeSinceChange = time - lastNoteChangeTime;
    if (timeSinceChange > arcFadeTime) return; // Arc has faded
    
    // Fade factor based on time since change
    const fadeProgress = timeSinceChange / arcFadeTime;
    const fadeAmount = 1 - fadeProgress;
    
    // Generate arc points along the orbital path
    for (let i = 0; i < arcDensity; i++) {
      const arcProgress = i / (arcDensity - 1); // 0 to 1
      const angleOffset = -arcProgress * arcLength; // Arc trails behind, ending at change position
      const arcAngle = changeRotation + angleOffset;
      
      // Calculate position on orbital path
      const basePos = this.calculateOrbitPosition(centerPos, orbitDistance, arcAngle, tilt, orbitType);
      
      // Expand outward from the orbital path
      const radiusExpansion = fadeProgress * arcRadiusMultiplier;
      const expansionDir = this.getOrbitExpansionDirection(arcAngle, tilt, orbitType);
      
      const finalPos: [number, number, number] = [
        basePos[0] + expansionDir[0] * radiusExpansion,
        basePos[1] + expansionDir[1] * radiusExpansion,
        basePos[2] + expansionDir[2] * radiusExpansion
      ];
      
      // Visual properties - brightest at current position (arcProgress = 0), fades toward tail
      const opacity = fadeAmount * 0.7 * (1 - arcProgress); // Fade from current position to tail
      const scale = fadeAmount * 0.3 * (1 - arcProgress * 0.5); // Slightly smaller toward tail
      const brightness = fadeAmount * 4 * (1 - arcProgress * 0.3); // Dimmer toward tail
      
      if (opacity > 0.01) {
        visuals.push({
          type: 'sphere',
          sourceNoteId: `arc-${orbitType}-${i}`,
          properties: {
            position: finalPos,
            scale: [scale, scale, scale],
            color: color,
            opacity: opacity,
            emissive: color,
            emissiveIntensity: brightness
          }
        });
      }
    }
  }

  private getOrbitExpansionDirection(angle: number, tilt: number, orbitType: 'main' | 'd' | 'e' | 'f'): [number, number, number] {
    // Direction perpendicular to the orbital plane for expansion
    switch (orbitType) {
      case 'main':
        return [0, 1, 0]; // Expand up/down from horizontal orbit
      case 'd': // 45 degree tilt around X axis
        return [0, Math.cos(tilt), -Math.sin(tilt)];
      case 'e': // Perpendicular to D
        return [Math.sin(angle), 0, Math.cos(angle)];
      case 'f': // Different plane
        return [Math.sin(tilt), 1, Math.cos(tilt)];
      default:
        return [0, 1, 0];
    }
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    // Count C notes (pitch % 12 === 0), D notes (pitch % 12 === 2), E notes (pitch % 12 === 4), and F notes (pitch % 12 === 5)
    let cNotesThatHaveStarted = 0;
    let dNotesThatHaveStarted = 0;
    let eNotesThatHaveStarted = 0;
    let fNotesThatHaveStarted = 0;
    let hasAnyCDEOrFNotes = false;
    
    for (const block of midiBlocks) {
      for (const note of block.notes) {
        const noteClass = note.pitch % 12;
        if (noteClass === 0 || noteClass === 2 || noteClass === 4 || noteClass === 5) { // C, D, E, or F note exists
          hasAnyCDEOrFNotes = true;
        }
        
        if (note.startBeat <= time) {
          if (noteClass === 0) { // C note
            cNotesThatHaveStarted++;
          } else if (noteClass === 2) { // D note
            dNotesThatHaveStarted++;
          } else if (noteClass === 4) { // E note
            eNotesThatHaveStarted++;
          } else if (noteClass === 5) { // F note
            fNotesThatHaveStarted++;
          }
        }
      }
    }

    // If no C, D, E, or F notes exist at all, return empty
    if (!hasAnyCDEOrFNotes) {
      return [];
    }

    const xOffset = this.getPropertyValue<number>('xOffset') ?? 5;
    const animationSpeed = this.getPropertyValue<number>('animationSpeed') ?? 2;
    const rotationSpeed = this.getPropertyValue<number>('rotationSpeed') ?? 1;
    const numPositions = this.getPropertyValue<number>('numPositions') ?? 4;
    const trailFadeTime = this.getPropertyValue<number>('trailFadeTime') ?? 1.0;
    const trailLength = this.getPropertyValue<number>('trailLength') ?? 50;

    // Generate positions dynamically based on current setting
    const currentPositions = this.generatePositions(numPositions);

    // Calculate position animation first
    const positionTimeSinceAnimation = time - this.positionAnimationStartTime;
    const positionAnimationDuration = 60 / (bpm * animationSpeed);
    const positionLinearProgress = positionTimeSinceAnimation / positionAnimationDuration;
    const positionEasedProgress = this.applyEasing(positionLinearProgress);
    const animatedPosition = this.lerpPosition(this.currentPosition, this.targetPosition, positionEasedProgress);

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
      
      // Store the target position for arc effect (where we're going to)
      this.arcCenterPosition = [...this.targetPosition];
      
      this.lastCNoteCount = cNotesThatHaveStarted;
      this.positionAnimationStartTime = time;
      
      console.log(`C note! Moving to position ${positionIndex}`);
    }

    // Handle D note orbit changes (45 degree tilt)
    if (dNotesThatHaveStarted !== this.lastDNoteCount) {
      // Store rotation for arc effect before changing
      this.arcDRotation = this.currentDRotation;
      
      this.currentDRotation = this.targetDRotation;
      this.targetDRotation += Math.PI * 2; // Full rotation
      
      this.lastDNoteCount = dNotesThatHaveStarted;
      this.dRotationAnimationStartTime = time;
      
      console.log(`D note! Adding orbit rotation`);
    }

    // Handle E note orbit changes (perpendicular, cumulative larger increments)
    if (eNotesThatHaveStarted !== this.lastENoteCount) {
      // Store rotation for arc effect before changing
      this.arcERotation = this.currentERotation;
      
      this.currentERotation = this.targetERotation;
      this.targetERotation += Math.PI / 3; // 60 degree increments (cumulative)
      
      this.lastENoteCount = eNotesThatHaveStarted;
      this.eRotationAnimationStartTime = time;
      
      console.log(`E note! Adding cumulative rotation`);
    }

    // Handle F note orbit changes (further out, pink orb, larger increments)
    if (fNotesThatHaveStarted !== this.lastFNoteCount) {
      // Store rotation for arc effect before changing
      this.arcFRotation = this.currentFRotation;
      
      this.currentFRotation = this.targetFRotation;
      this.targetFRotation += Math.PI / 2; // 90 degree increments (cumulative, larger than E orb)
      
      this.lastFNoteCount = fNotesThatHaveStarted;
      this.fRotationAnimationStartTime = time;
      
      console.log(`F note! Adding cumulative rotation`);
    }

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

    // Calculate F note orbit animation (further out, pink orb, very fast like E) with idle rotation
    const fRotationTimeSinceAnimation = time - this.fRotationAnimationStartTime;
    const fRotationAnimationDuration = 0.1; // Very small animation time (0.1 beats) like E orb
    const fRotationLinearProgress = fRotationTimeSinceAnimation / fRotationAnimationDuration;
    const fRotationEasedProgress = this.applyEasing(fRotationLinearProgress);
    const animatedFRotation = this.lerp(this.currentFRotation, this.targetFRotation, fRotationEasedProgress) + 
                              (time * idleRotationSpeed * 0.5); // Add continuous idle rotation (slightly slower than E)

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

    // Calculate F orb position (further out than E orb, different orbital plane)
    const fOrbitDistance = 3.0; // Further out than E orb
    const fTilt = Math.PI / 6; // 30 degrees, different tilt for variety
    const fOrbX = animatedPosition[0] + Math.cos(animatedFRotation) * fOrbitDistance * Math.cos(fTilt);
    const fOrbY = animatedPosition[1] + Math.sin(animatedFRotation) * fOrbitDistance;
    const fOrbZ = animatedPosition[2] + Math.sin(animatedFRotation) * fOrbitDistance * Math.sin(fTilt);


    // Update trails with actual rotation values for perfect sync
    if (hasAnyCDEOrFNotes) {
      // Main ball trail - use simple trail since it's not rotating around a center
      this.updateTrail(this.mainBallTrail, animatedPosition, time, trailFadeTime, trailLength);
    }
    if (dNotesThatHaveStarted > 0) {
      // D orb trail - 45 degree tilted orbit around main ball
      const tilt = Math.PI / 4; // 45 degrees
      this.updateTrailWithRotation(this.dOrbTrail, [dOrbX, dOrbY, dOrbZ], time, trailFadeTime, trailLength, animatedPosition, dOrbitDistance, tilt, animatedDRotation, 'd');
    }
    if (eNotesThatHaveStarted > 0) {
      // E orb trail - perpendicular 45 degree orbit
      const eTilt = Math.PI / 4; // 45 degrees, perpendicular to D orb
      this.updateTrailWithRotation(this.eOrbTrail, [eOrbX, eOrbY, eOrbZ], time, trailFadeTime, trailLength, animatedPosition, eOrbitDistance, eTilt, animatedERotation, 'e');
    }
    if (fNotesThatHaveStarted > 0) {
      // F orb trail - 30 degree tilted orbit
      const fTilt = Math.PI / 6; // 30 degrees
      this.updateTrailWithRotation(this.fOrbTrail, [fOrbX, fOrbY, fOrbZ], time, trailFadeTime, trailLength, animatedPosition, fOrbitDistance, fTilt, animatedFRotation, 'f');
    }

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

    // Add F orb if F notes exist
    if (fNotesThatHaveStarted > 0) {
      visuals.push({
        type: 'sphere',
        sourceNoteId: 'f-orbiting-satellite',
        properties: {
          position: [fOrbX, fOrbY, fOrbZ] as [number, number, number],
          scale: [0.4, 0.4, 0.4],
          color: '#ff66cc',
          opacity: 1,
          emissive: '#ff66cc',
          emissiveIntensity: 1.5
        }
      });
    }

    // Add orbital arc effects
    if (this.getPropertyValue<boolean>('arcEnabled')) {
      // Main ball arc (when moving between positions)
      this.addOrbitalArcVisuals(visuals, this.arcCenterPosition, 0, 0, 0, 'main', '#ff6600', this.positionAnimationStartTime, time);
      
      // D orb arc
      if (dNotesThatHaveStarted > 0) {
        const dTilt = Math.PI / 4;
        this.addOrbitalArcVisuals(visuals, this.arcCenterPosition, this.arcDRotation, dOrbitDistance, dTilt, 'd', '#ff9900', this.dRotationAnimationStartTime, time);
      }
      
      // E orb arc
      if (eNotesThatHaveStarted > 0) {
        const eTilt = Math.PI / 4;
        this.addOrbitalArcVisuals(visuals, this.arcCenterPosition, this.arcERotation, eOrbitDistance, eTilt, 'e', '#0066ff', this.eRotationAnimationStartTime, time);
      }
      
      // F orb arc
      if (fNotesThatHaveStarted > 0) {
        const fTilt = Math.PI / 6;
        this.addOrbitalArcVisuals(visuals, this.arcCenterPosition, this.arcFRotation, fOrbitDistance, fTilt, 'f', '#ff66cc', this.fRotationAnimationStartTime, time);
      }
    }

    // Generate trail visuals
    if (this.getPropertyValue<boolean>('trailEnabled')) {
      this.addTrailVisuals(visuals, this.mainBallTrail, '#ff6600', 'main-trail', true); // Bigger spheres for main ball
      this.addTrailVisuals(visuals, this.dOrbTrail, '#ff9900', 'd-trail');
      this.addTrailVisuals(visuals, this.eOrbTrail, '#0066ff', 'e-trail');
      this.addTrailVisuals(visuals, this.fOrbTrail, '#ff66cc', 'f-trail');
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