import React, { useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Content rendered above the overlay (e.g. transformed elements) swallows
  // clicks, so forward any click on the zone to the hidden input.
  const handleClick = (e: React.MouseEvent) => {
    if (e.target !== inputRef.current) inputRef.current?.click();
  };

  return (
    <div {...dropZoneProps} onClick={handleClick} className={className(isDragging)}>
      <input
        ref={inputRef}
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
