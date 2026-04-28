'use client';

import React from 'react';
import Model from 'react-body-highlighter';

export default function MuscleMap({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>No Map Data</div>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%', width: '100%', overflow: 'hidden', padding: '5px', gap: '5px' }}>
      <Model
        type="anterior"
        data={data}
        style={{ height: '100%', maxHeight: '140px', width: '48%' }}
        highlightedColors={['#5eead4', '#14b8a6', '#0d9488', '#0f766e', '#1e3a8a']}
        bodyColor="#CBD5E1"
      />
      <Model
        type="posterior"
        data={data}
        style={{ height: '100%', maxHeight: '140px', width: '48%' }}
        highlightedColors={['#5eead4', '#14b8a6', '#0d9488', '#0f766e', '#1e3a8a']}
        bodyColor="#CBD5E1"
      />
    </div>
  );
}
