import React, { useState, useCallback, useRef } from 'react';
import useStore from '../store/store';
import { saveAudioFile } from '../lib/idbHelper';
import { Upload } from 'lucide-react';
import { FileAudio, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog"

const AudioLoader: React.FC = () => {
    const loadAudioAction = useStore(state => state.loadAudio);
    const isAudioLoaded = useStore(state => state.isAudioLoaded);
    const audioDuration = useStore(state => state.audioDuration);
    const audioFileName = useStore(state => state.audioFileName);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileClick = () => {
      fileInputRef.current?.click()
    }
    
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
                await loadAudioAction(arrayBuffer, file.name);

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
      <div
            className="p-2 flex items-center justify-between border-t"
          >
            <div className="flex items-center space-x-4">
              <span className="text-sm">Audio:</span>

              {audioFileName ? (
                <div
                  className="flex items-center rounded-md border px-3 py-1"
                >
                  <FileAudio className="h-4 w-4 mr-2"/>
                  <span className="text-sm truncate max-w-[200px]">{audioFileName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-2 rounded-full hover:bg-[#444]"
                    // onClick={clearAudioFile}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-sm rounded-md transition-all flex items-center hover:bg-[#444]"
                  // style={{ backgroundColor: "#333", borderColor: COLORS.border }}
                  onClick={handleFileClick}
                >
                  <Upload className="h-3 w-3 mr-2" />
                  Load Audio
                </Button>
              )}

              <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
            </div>

            <div className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">{audioFileName ? "Audio loaded" : "No audio loaded"}</span>
            </div>

            <Dialog open={isLoading} onOpenChange={setIsLoading}>
              <DialogContent className="sm:max-w-md"
              //  style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
               >
                <DialogHeader>
                  <DialogTitle>Loading Audio</DialogTitle>
                  <DialogDescription>Please wait while your audio file is being processed...</DialogDescription>
                </DialogHeader>
                {/* <div className="py-6">
                  <Progress value={loadingProgress} className="w-full" />
                  <p className="text-center mt-2 text-sm text-gray-400">{loadingProgress}%</p>
                </div> */}
              </DialogContent>
            </Dialog>
          </div>
        // <div style={{
        //     display: 'flex',
        //     alignItems: 'center',
        //     gap: '15px',
        //     width: '100%',
        //     height: '100%',
        //     padding: '0 15px',
        //     backgroundColor: '#e9e9e9',
        //     color: '#333',
        //     border: 'none',
        //     boxSizing: 'border-box'
        // }}>
        //     <label htmlFor="audio-upload" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Load Background Audio:</label>
        //     <input
        //         id="audio-upload"
        //         type="file"
        //         accept="audio/*"
        //         onChange={handleFileChange}
        //         disabled={isLoading}
        //     />
        //     <div style={{ flexShrink: 0 }}>
        //         {isLoading && <span>Loading...</span>}
        //         {error && <span style={{ color: 'red' }}>Error: {error}</span>}
        //         {isAudioLoaded && !isLoading && (
        //             <span style={{ color: 'green' }}>
        //                 Loaded! Duration: {audioDuration?.toFixed(2)}s
        //             </span>
        //         )}
        //         {!isAudioLoaded && !isLoading && !error && <span>No audio loaded.</span>}
        //     </div>
        // </div>
    );
};

export default AudioLoader; 