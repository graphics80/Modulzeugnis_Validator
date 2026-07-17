import React from 'react';
import { useFileDrop } from '../hooks/useFileDrop';

const ACCEPTED_FILES = '.pdf,.txt';

interface Props {
  onFile: (file: File) => void;
  isProcessing?: boolean;
  className: (isDragging: boolean) => string;
  children: (isDragging: boolean) => React.ReactNode;
}

// Shared drop-zone shell: drag wiring + invisible file-input overlay.
// Callers supply their own styling and inner content via render props.
const DropZone: React.FC<Props> = ({ onFile, isProcessing, className, children }) => {
  const { isDragging, dropZoneProps, onInputChange } = useFileDrop(onFile);

  return (
    <div {...dropZoneProps} className={className(isDragging)}>
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={onInputChange}
        accept={ACCEPTED_FILES}
        disabled={isProcessing}
      />
      {children(isDragging)}
    </div>
  );
};

export default DropZone;
