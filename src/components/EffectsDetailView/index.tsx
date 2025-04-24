'use client';

import React from 'react';
import styles from './EffectsDetailView.module.css';

interface EffectsDetailViewProps {
  track: number;
}

function EffectsDetailView({ track }: EffectsDetailViewProps) {
  return (
    <div className={styles.container}>
      <h3>Effects for Track {track}</h3>
      <p>Effects settings will be implemented here.</p>
    </div>
  );
}

export default EffectsDetailView; 