'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PercussionCubeSynthProps {
  noteTrigger: number; // A simple counter or timestamp that changes on each note
  size?: number; // Size of the square path
  speed?: number; // Speed of movement between corners
}

const PercussionCubeSynth: React.FC<PercussionCubeSynthProps> = ({
  noteTrigger,
  size = 4, // Default size of the square path
  speed = 5, // Default speed
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [targetIndex, setTargetIndex] = useState(0);
  const currentPosition = useRef<THREE.Vector3>(new THREE.Vector3(size / 2, size / 2, 0)); // Start at corner 0

  // Define the four corners
  const corners = [
    new THREE.Vector3(size / 2, size / 2, 0),  // Top Right
    new THREE.Vector3(size / 2, -size / 2, 0), // Bottom Right
    new THREE.Vector3(-size / 2, -size / 2, 0),// Bottom Left
    new THREE.Vector3(-size / 2, size / 2, 0), // Top Left
  ];

  // Effect to update the target corner when the trigger changes
  useEffect(() => {
    setTargetIndex((prevIndex) => (prevIndex + 1) % 4);
  }, [noteTrigger]);

  // Animation loop
  useFrame((state, delta) => {
    const targetPosition = corners[targetIndex];
    const current = currentPosition.current;

    // Move towards the target position
    if (!current.equals(targetPosition)) {
      const direction = targetPosition.clone().sub(current).normalize();
      const distanceToTarget = current.distanceTo(targetPosition);
      const moveDistance = speed * delta;

      if (moveDistance >= distanceToTarget) {
        // Snap to target if close enough or overshot
        current.copy(targetPosition);
      } else {
        // Move along the direction vector
        current.add(direction.multiplyScalar(moveDistance));
      }
      
      // Update mesh position
      if (meshRef.current) {
        meshRef.current.position.copy(current);
      }
    }
  });

  // Initialize position
  useEffect(() => {
    if (meshRef.current) {
        meshRef.current.position.copy(currentPosition.current);
    }
  }, [])

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
};

export default PercussionCubeSynth; 