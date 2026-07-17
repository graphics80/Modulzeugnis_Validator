import React, { useState } from 'react';

// Shared drag & drop + file-input wiring for the upload zones.
export const useFileDrop = (onFile: (file: File) => void) => {
  const [isDragging, setIsDragging] = useState(false);

  const dropZoneProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change event
    e.target.value = '';
    if (file) onFile(file);
  };

  return { isDragging, dropZoneProps, onInputChange };
};
