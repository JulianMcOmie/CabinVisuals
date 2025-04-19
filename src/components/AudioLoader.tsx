import React, { useState, useCallback } from 'react';
import useStore from '../store/store';
import { saveAudioFile } from '../lib/idbHelper';

const AudioLoader: React.FC = () => {
    const loadAudioAction = useStore(state => state.loadAudio);
    const isAudioLoaded = useStore(state => state.isAudioLoaded);
    const audioDuration = useStore(state => state.audioDuration);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);

        const fileToPersist = file;

        const reader = new FileReader();

        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
                setError('Failed to read file.');
                setIsLoading(false);
                return;
            }

            try {
                await loadAudioAction(arrayBuffer);

                try {
                    await saveAudioFile(fileToPersist);
                    console.log('Audio file persisted to IndexedDB.');
                } catch (idbError) {
                    console.error('Failed to save audio file to IndexedDB:', idbError);
                }

            } catch (err) {
                console.error("Error loading audio:", err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred during audio loading.');
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            setError('Error reading file.');
            setIsLoading(false);
        };

        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }, [loadAudioAction]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            width: '100%',
            height: '100%',
            padding: '0 15px',
            backgroundColor: '#e9e9e9',
            color: '#333',
            border: 'none',
            boxSizing: 'border-box'
        }}>
            <label htmlFor="audio-upload" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Load Background Audio:</label>
            <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={isLoading}
            />
            <div style={{ flexShrink: 0 }}>
                {isLoading && <span>Loading...</span>}
                {error && <span style={{ color: 'red' }}>Error: {error}</span>}
                {isAudioLoaded && !isLoading && (
                    <span style={{ color: 'green' }}>
                        Loaded! Duration: {audioDuration?.toFixed(2)}s
                    </span>
                )}
                {!isAudioLoaded && !isLoading && !error && <span>No audio loaded.</span>}
            </div>
        </div>
    );
};

export default AudioLoader; 