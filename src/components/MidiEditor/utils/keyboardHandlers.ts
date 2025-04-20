import { MIDIBlock, MIDINote } from '../../../lib/types';
import { copyNotes, pasteNotes, deleteSelectedNotes } from './noteOperations';

/**
 * Returns action data based on keyboard shortcut
 * This is the pure function that doesn't manipulate state directly
 */
export const getKeyboardAction = (
  key: string,
  ctrlKey: boolean,
  metaKey: boolean,
  block: MIDIBlock,
  selectedNoteIds: string[],
    copiedNotes: MIDINote[],
  currentBeat: number
): {
  action: 'delete' | 'escape' | 'copy' | 'paste' | 'none',
  updatedBlock?: MIDIBlock,
  pastedNoteIds?: string[],
  copiedNoteData?: MIDINote[],
  message?: string
} => {
  // Delete selected notes
  if ((key === 'Delete' || key === 'Backspace') && selectedNoteIds.length > 0) {
    const updatedBlock = deleteSelectedNotes(block, selectedNoteIds);
    return { 
      action: 'delete', 
      updatedBlock 
    };
  }
  
  // Escape key to clear selection
  if (key === 'Escape') {
    return { action: 'escape' };
  }
  
  // Copy with Ctrl+C / Cmd+C
  if ((ctrlKey || metaKey) && key === 'c' && selectedNoteIds.length > 0) {
    const notesCopy = copyNotes(block.notes, selectedNoteIds);
    return { 
      action: 'copy', 
      copiedNoteData: notesCopy,
      message: `Copied ${notesCopy.length} notes` 
    };
  }
  
  // Paste with Ctrl+V / Cmd+V
  if ((ctrlKey || metaKey) && key === 'v' && copiedNotes.length > 0) {
    
    const { updatedBlock, pastedNoteIds } = pasteNotes(block, copiedNotes, 0, currentBeat);
    return { 
      action: 'paste', 
      updatedBlock,
      pastedNoteIds,
      message: `Pasted ${pastedNoteIds.length} notes` 
    };
  }
  
  return { action: 'none' };
};

/**
 * Handles keyboard shortcuts for the MIDI editor
 * This applies the action to the state
 */
export const handleKeyboardShortcuts = (
  e: KeyboardEvent,
  block: MIDIBlock,
  selectedNoteIds: string[],
  copiedNotes: MIDINote[],
  trackId: string,
  updateMidiBlock: (trackId: string, block: MIDIBlock) => void,
  setSelectedNoteIds: (ids: string[]) => void,
  storeSelectNotes: (notes: MIDINote[]) => void,
  setCopiedNotes: (notes: MIDINote[]) => void,
  seekTo: (beat: number) => void,
  currentBeat: number
): void => {
  // Skip if focus is on input element
  if (
    document.activeElement && 
    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
  ) {
    return;
  }

  const result = getKeyboardAction(
    e.key,
    e.ctrlKey,
    e.metaKey,
    block,
    selectedNoteIds,
    copiedNotes,
    currentBeat
  );
  
  switch (result.action) {
    case 'delete':
      if (result.updatedBlock) {
        updateMidiBlock(trackId, result.updatedBlock);
        setSelectedNoteIds([]);
        storeSelectNotes([]);
      }
      break;
      
    case 'escape':
      setSelectedNoteIds([]);
      storeSelectNotes([]);
      break;
      
    case 'copy':
      if (result.copiedNoteData) {
        setCopiedNotes(result.copiedNoteData);
        if (result.message) console.log(result.message);
      }
      break;
      
    case 'paste':
      if (result.updatedBlock && result.pastedNoteIds) {
        updateMidiBlock(trackId, result.updatedBlock);
        
        // Select the newly pasted notes
        setSelectedNoteIds(result.pastedNoteIds);
        storeSelectNotes(result.updatedBlock.notes.filter(note => 
          result.pastedNoteIds!.includes(note.id)
        ));
        
        if (result.message) console.log(result.message);
      }
      // Seek to end of pasted notes
      if (result.pastedNoteIds) {
        let maxEndBeat = 0;
        for (const noteId of result.pastedNoteIds) {
          const note = result.updatedBlock?.notes.find(note => note.id === noteId);
          if (note) {
            maxEndBeat = Math.max(maxEndBeat, note.startBeat + note.duration);
          }
        }
        seekTo(maxEndBeat);
      }
      break;
  }
}; 