import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress'; // Assuming you have a Progress component

interface ExportViewProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number; // 0 to 100
  statusMessage: string;
  onCancel?: () => void; // Optional cancel action
}

const ExportView: React.FC<ExportViewProps> = ({
  isOpen,
  onClose,
  progress,
  statusMessage,
  onCancel
}) => {
  // We control the open state from the parent (PlaybarView)
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(); // Call onClose when the dialog is dismissed
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}> {/* Prevent closing on outside click during export */}
        <DialogHeader>
          <DialogTitle>Video Export</DialogTitle>
          <DialogDescription>
            {statusMessage}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Progress value={progress} className="w-full" />
          <p className="text-center text-sm text-muted-foreground">{progress.toFixed(0)}% Complete</p>
        </div>
        {/* Optional Cancel Button - implementation depends on backend */}
        {/* {onCancel && (
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </DialogFooter>
        )} */}
      </DialogContent>
    </Dialog>
  );
};

export default ExportView; 