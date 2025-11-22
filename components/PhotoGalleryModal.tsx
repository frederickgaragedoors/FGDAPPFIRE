import React, { useState, useEffect, useCallback } from 'react';
import { XIcon, ChevronLeftIcon, ChevronRightIcon } from './icons.tsx';

interface PhotoGalleryModalProps {
  images: { url: string; name: string }[];
  startIndex: number;
  onClose: () => void;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ images, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPrevious, goToNext, onClose]);
  
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-slate-300 z-50 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full"
          aria-label="Close gallery"
        >
          <XIcon className="w-6 h-6" />
        </button>

        {/* Main Content */}
        <div className="relative w-full max-w-4xl h-full max-h-[85vh] flex items-center justify-center">
            {/* Image */}
            <div className="w-full h-full flex items-center justify-center">
                <img
                    src={images[currentIndex].url}
                    alt={images[currentIndex].name}
                    className="max-h-full max-w-full object-contain"
                />
            </div>
          
            {/* Prev Button */}
            {images.length > 1 && (
                <button
                    onClick={goToPrevious}
                    className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full"
                    aria-label="Previous image"
                >
                    <ChevronLeftIcon className="w-8 h-8" />
                </button>
            )}

            {/* Next Button */}
            {images.length > 1 && (
                <button
                    onClick={goToNext}
                    className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 p-2 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full"
                    aria-label="Next image"
                >
                    <ChevronRightIcon className="w-8 h-8" />
                </button>
            )}
        </div>

        {/* Caption and Counter */}
        <div className="text-white text-center mt-2">
            <p className="text-lg font-medium">{images[currentIndex].name}</p>
            {images.length > 1 && (
                <p className="text-sm text-slate-300">{`${currentIndex + 1} / ${images.length}`}</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default PhotoGalleryModal;