import React, { useState, useCallback } from 'react';
import useStore from '../store/store';

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
                // State update (isAudioLoaded, audioDuration) happens within the store action
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

        // Reset file input to allow reloading the same file if needed
        event.target.value = '';

    }, [loadAudioAction]);

    return (
        <div style={{ margin: '10px', padding: '10px', border: '1px solid #ccc' }}>
            <label htmlFor="audio-upload">Load Background Audio:</label>
            <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={isLoading}
                style={{ marginLeft: '10px' }}
            />
            {isLoading && <p>Loading audio...</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            {isAudioLoaded && !isLoading && (
                <p style={{ color: 'green' }}>
                    Audio loaded successfully! Duration: {audioDuration?.toFixed(2)}s
                </p>
            )}
             {!isAudioLoaded && !isLoading && !error && <p>No audio loaded.</p>}
        </div>
    );
};

export default AudioLoader; 