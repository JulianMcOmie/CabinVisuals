import Synthesizer from '../Synthesizer';
import { MIDIBlock, VisualObject } from '../types';

/**
 * FractalSynth - Creates triangle-based fractal patterns
 * 
 * - Pitch maps to vertical position (height)
 * - Velocity maps to fractal detail level (number of triangles)
 * - Duration maps to expansion speed
 */
class FractalSynth extends Synthesizer {
  // Base size of individual triangles - significantly increased for better visibility
  private triangleSize: number = 5;

  constructor() {
    super();
  }

  /**
   * Generates a Sierpinski triangle fractal pattern with specified parameters
   * @param iterations Number of fractal iterations (complexity)
   * @param time Current time
   * @param expansionSpeed How fast the fractal expands
   * @param noteStartTime When the note started
   * @param noteEndTime When the note ends
   * @param baseSize Base size of the overall fractal
   */
  private generateTriangleFractal(
    iterations: number,
    time: number,
    expansionSpeed: number, 
    noteStartTime: number,
    noteEndTime: number,
    baseSize: number
  ): { positions: [number, number, number][], triangleCount: number } {
    const positions: [number, number, number][] = [];
    let triangleCount = 0;
    
    // Calculate time since the note started
    const timeSinceStart = time - noteStartTime;
    
    // Calculate note progress (0 to 1) for the detail evolution
    const noteDuration = noteEndTime - noteStartTime;
    const noteProgress = Math.min(1, timeSinceStart / noteDuration);
    
    // Dynamic iteration level that increases as the note plays
    // Start with minimum iterations and increase to the maximum specified
    const minIterations = 1;
    const dynamicIterations = Math.floor(minIterations + (iterations - minIterations) * noteProgress);
    
    // Calculate phasing effect based on time
    // This creates a subtle movement in the triangle positions
    const phaseFactor = Math.sin(time * 3.0) * 0.05; // Subtle oscillation (5% movement)
    
    // Keep the baseSize constant - this is the size of the initial triangle
    // We're not using expansionProgress anymore as we want fixed-size triangles
    const initialSize = baseSize; 
    
    // Initial triangle vertices - these points define the outermost triangle
    const p1: [number, number, number] = [
      0 + phaseFactor, 
      initialSize * 0.866, 
      0
    ]; // Top
    const p2: [number, number, number] = [
      -initialSize / 2 - phaseFactor, 
      0, 
      0
    ]; // Bottom left
    const p3: [number, number, number] = [
      initialSize / 2 + phaseFactor, 
      0, 
      0
    ]; // Bottom right
    
    // We'll use this to collect ALL triangles at each level
    // This way we can render each triangle at its fixed size
    const allTriangles: Array<[number, number, number][]> = [];
    
    // Function to collect triangles at specific depths
    const collectTrianglesAtDepth = (
      a: [number, number, number], 
      b: [number, number, number], 
      c: [number, number, number], 
      depth: number,
      currentDepth: number = 0
    ) => {
      // If we've reached the target depth or maximum depth, add this triangle
      if (depth === 0 || currentDepth >= dynamicIterations) {
        allTriangles.push([a, b, c]);
        return;
      }
      
      // Find midpoints
      const ab: [number, number, number] = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2
      ];
      
      const bc: [number, number, number] = [
        (b[0] + c[0]) / 2,
        (b[1] + c[1]) / 2,
        (b[2] + c[2]) / 2
      ];
      
      const ca: [number, number, number] = [
        (c[0] + a[0]) / 2,
        (c[1] + a[1]) / 2,
        (c[2] + a[2]) / 2
      ];
      
      // Collect triangles at the next depth
      collectTrianglesAtDepth(a, ab, ca, depth - 1, currentDepth + 1);
      collectTrianglesAtDepth(ab, b, bc, depth - 1, currentDepth + 1);
      collectTrianglesAtDepth(ca, bc, c, depth - 1, currentDepth + 1);
    };
    
    // Collect all triangles - start with the maximum depth we want to render
    // This function will collect triangles at all depths up to dynamicIterations
    collectTrianglesAtDepth(p1, p2, p3, iterations, 0);
    
    // Now, we'll add each triangle to our positions array
    for (const triangle of allTriangles) {
      positions.push(...triangle);
      triangleCount++;
    }
    
    return { positions, triangleCount };
  }

  /**
   * Map MIDI velocity (0-127) to fractal iterations (1-7)
   * Higher iterations = more triangles in the fractal
   */
  private mapVelocityToIterations(velocity: number): number {
    // Increased iterations at each velocity level for more triangles
    if (velocity < 20) return 2;     // Was 1, now 2
    if (velocity < 40) return 3;     // Was 2, now 3
    if (velocity < 60) return 4;     // Was 3, now 4
    if (velocity < 80) return 5;     // Was 4, now 5
    if (velocity < 100) return 6;    // Was 5, now 6
    return 7;                        // Was 6, now 7 (maximum for performance reasons)
  }

  /**
   * Map MIDI pitch (0-127) to a color
   */
  private mapPitchToColor(pitch: number): string {
    // Map note within octave to hue (0-360)
    const noteInOctave = pitch % 12;
    const hue = (noteInOctave * 30) % 360; // 30 degrees per semitone
    
    // Map octave to lightness and saturation
    const octave = Math.floor(pitch / 12);
    const lightness = 50 + Math.min(octave * 5, 30); // 50-80% range
    const saturation = 70 + Math.min(octave * 3, 30); // 70-100% range
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Map MIDI duration to expansion speed
   * This determines how quickly the fractal adds triangles
   */
  private mapDurationToExpansionSpeed(duration: number): number {
    // For longer notes, we want a slower progression of triangle detail
    // For shorter notes, we want a faster progression
    // Range: 0.5 (very slow growth) to 5.0 (very fast growth)
    const baseSpeed = 1.0;
    return Math.max(0.5, Math.min(5.0, baseSpeed * (2.0 / duration)));
  }

  /**
   * Map MIDI pitch to vertical position
   */
  private mapPitchToHeight(pitch: number): number {
    // Map full MIDI range (0-127) to position (-6 to 6)
    return -6 + (pitch / 127) * 12;
  }

  getObjectsAtTime(time: number, midiBlocks: MIDIBlock[], bpm: number): VisualObject[] {
    const objects: VisualObject[] = [];
    const secondsPerBeat = 60 / bpm;
    
    // Process all MIDI blocks
    midiBlocks.forEach(block => {
      const blockStartBeat = block.startBeat;
      
      // Process all notes
      block.notes.forEach(note => {
        const noteStartBeat = blockStartBeat + note.startBeat;
        const noteEndBeat = noteStartBeat + note.duration;
        
        // Convert to seconds for timing calculations
        const noteStartTime = noteStartBeat * secondsPerBeat;
        const noteEndTime = noteEndBeat * secondsPerBeat;
        const currentTime = time * secondsPerBeat;
        
        // Check if the note is active or in release phase (1 second tail)
        const isActive = currentTime >= noteStartTime && 
                         currentTime <= noteEndTime + 1.0;
        
        if (isActive) {
          // Calculate amplitude (for opacity)
          let amplitude;
          
          if (currentTime <= noteEndTime) {
            // Active note phase - full opacity
            amplitude = 1.0;
          } else {
            // Release phase - fade out
            const releaseTime = currentTime - noteEndTime;
            amplitude = Math.max(0, 1.0 - releaseTime);
          }
          
          // Skip if amplitude is too low
          if (amplitude < 0.05) return;
          
          // Map note properties to visual parameters
          const yPosition = this.mapPitchToHeight(note.pitch);
          const iterations = this.mapVelocityToIterations(note.velocity);
          const expansionSpeed = this.mapDurationToExpansionSpeed(note.duration);
          const color = this.mapPitchToColor(note.pitch);
          
          // Set base size - increased for larger overall triangle structure
          const baseSize = 10;
          
          // Generate fractal structure
          const { positions, triangleCount } = this.generateTriangleFractal(
            iterations,
            currentTime,
            expansionSpeed,
            noteStartTime,
            noteEndTime,
            baseSize
          );
          
          // Add phasing to color by cycling hue slightly based on time
          const phasedColor = this.addColorPhasing(color, currentTime - noteStartTime);
          
          // Create the visual object with custom triangle data
          objects.push({
            type: 'triangleFractal',
            properties: {
              position: [0, yPosition, -10], // x, y, z
              rotation: [0, time * 0.1, time * 0.05], // gentle rotation with phasing 
              scale: [1, 1, 1], // uniform scale
              color: phasedColor,
              opacity: amplitude,
              // Custom properties for rendering
              trianglePositions: positions,
              triangleSize: this.triangleSize,
              triangleCount: triangleCount
            }
          });
        }
      });
    });
    
    return objects;
  }
  
  /**
   * Add a phasing effect to the color
   */
  private addColorPhasing(baseColor: string, timeSinceStart: number): string {
    // Parse the HSL color
    const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!hslMatch) return baseColor;
    
    const h = parseInt(hslMatch[1], 10);
    const s = parseInt(hslMatch[2], 10);
    const l = parseInt(hslMatch[3], 10);
    
    // Phase the hue based on time (oscillate ±10 degrees)
    const hueShift = Math.sin(timeSinceStart * 4) * 10;
    const newHue = (h + hueShift) % 360;
    
    // Create new HSL color
    return `hsl(${newHue}, ${s}%, ${l}%)`;
  }
}

export default FractalSynth; 