import { type } from "os";

/**
 * Provides utility functions for physics-based calculations.
 */
export class PhysicsUtils {
    /**
     * Calculates the displacement of a damped harmonic oscillator at a given time.
     * This simulates a spring-mass-damper system triggered by an initial velocity.
     *
     * The system is defined by: x'' + (friction/mass) * x' + (tension/mass) * x = 0
     * We assume mass = 1 for simplicity.
     *
     * @param time The time elapsed since the trigger (t).
     * @param tension The spring stiffness (k). Controls oscillation frequency. Must be positive.
     * @param friction The damping coefficient (c). Controls how quickly oscillations decay. Must be non-negative.
     * @param initialVelocity The initial velocity imparted to the system at time = 0 (x'(0)).
     * @returns The displacement (x) from the equilibrium position at the given time.
     */
    static calculateDampedOscillator(
        time: number,
        tension: number,
        friction: number,
        initialVelocity: number
    ): number {
        // Ensure valid parameters to avoid mathematical issues
        if (tension <= 0) {
            console.warn("PhysicsUtils: Tension must be positive. Using a small default.");
            tension = 0.1; // Use a small positive value instead of 0
        }
        if (friction < 0) {
             console.warn("PhysicsUtils: Friction must be non-negative. Clamping to 0.");
             friction = 0;
        }
        if (time < 0) {
            return 0; // No displacement before trigger
        }
         if (initialVelocity === 0) {
             return 0; // No initial impulse, no movement
         }


        const omega_n = Math.sqrt(tension); // Natural frequency (mass = 1)
        const zeta = friction / (2 * Math.sqrt(tension)); // Damping ratio (mass = 1)

        let displacement = 0;

        // Case 1: Underdamped (zeta < 1) - Oscillations
        if (zeta < 1) {
            const omega_d = omega_n * Math.sqrt(1 - zeta * zeta); // Damped frequency
            if (omega_d === 0) {
                 // This can happen if zeta is extremely close to 1 due to floating point math
                 // Fallback to critically damped case
                 displacement = initialVelocity * time * Math.exp(-omega_n * time);
            } else {
                 displacement = (initialVelocity / omega_d) * Math.exp(-zeta * omega_n * time) * Math.sin(omega_d * time);
            }
        }
        // Case 2: Critically Damped (zeta === 1) - Fastest decay, no oscillation
        else if (zeta === 1) {
            displacement = initialVelocity * time * Math.exp(-omega_n * time);
        }
        // Case 3: Overdamped (zeta > 1) - Slow decay, no oscillation
        else {
            const alpha = omega_n * Math.sqrt(zeta * zeta - 1);
             // Use sinh for numerical stability compared to difference of exponentials
             if (alpha === 0) {
                 // This might happen with very large friction/zeta approaching infinity? Fallback needed.
                 // Or if zeta is extremely close to 1. Fallback to critical damping.
                 displacement = initialVelocity * time * Math.exp(-omega_n * time);
             } else {
                 displacement = (initialVelocity / alpha) * Math.exp(-zeta * omega_n * time) * Math.sinh(alpha * time);
             }
        }

        return displacement;
    }

     // Add other physics utility functions here if needed...
} 