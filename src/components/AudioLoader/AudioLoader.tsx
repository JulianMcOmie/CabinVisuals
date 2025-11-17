import React, { useState, useCallback, useRef } from 'react';
import useStore from '../../store/store';
import { saveAudioFile } from '../../lib/idbHelper';
import { Upload } from 'lucide-react';
import { FileAudio, Volume2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Progress } from "../ui/progress";
import styles from './audioloader.module.css';

const AudioLoader: React.FC = () => {
    const loadAudioAction = useStore(state => state.loadAudio);
    const audioFileName = useStore(state => state.audioFileName);
    const clearAudio = useStore(state => state.clearAudio);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadingProgress = useStore(state => state.loadingProgress);
    
    const handleFileClick = () => {
      fileInputRef.current?.click()
    }
    
    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);

        const fileToPersist = file;

        const reader = new FileReader();

        reader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
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
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            setIsLoading(false);
        };

        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }, [loadAudioAction]);

    return (
      <div className={styles.container}>
        <div className={styles.audioSection}>
          <span className={styles.statusText}>Audio:</span>

          {audioFileName ? (
            <div className={styles.audioFileContainer}>
              <FileAudio className={`${styles.icon} ${styles.iconWithMargin}`} />
              <span className={styles.audioFileName}>{audioFileName}</span>
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearButton}
                onClick={clearAudio}
              >
                <X className={styles.xIcon} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={styles.loadButton}
              onClick={handleFileClick}
            >
              <Upload className={`${styles.icon} ${styles.iconWithMargin}`} />
              Load Audio
            </Button>
          )}

          <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
        </div>

        <div className={styles.statusSection}>
          <Volume2 className={styles.volumeIcon} />
          <span className={styles.statusText}>{audioFileName ? "Audio loaded" : "No audio loaded"}</span>
        </div>

        <Dialog open={isLoading} onOpenChange={setIsLoading}>
          <DialogContent className={styles.dialogContent}>
            <DialogHeader>
              <DialogTitle>Loading Audio</DialogTitle>
              <DialogDescription>Please wait while your audio file is being processed...</DialogDescription>
            </DialogHeader>
            <div className={styles.progressContainer}>
              <Progress value={loadingProgress} className="w-full" />
              <p className={styles.progressText}>{loadingProgress}%</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
};

export default AudioLoader; 