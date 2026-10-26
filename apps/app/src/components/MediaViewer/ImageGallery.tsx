"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { convertMediaUrlToNextRoute } from "@/lib/media-url-utils";
import { MediaOptimizationUtils, type MediaFile as BaseMediaFile } from "@/lib/media-optimization-utils";
import { ImageViewer } from "./ImageViewer";

interface MediaFile extends BaseMediaFile {
  order?: number;
}

interface ImageGalleryProps {
  mediaFiles: MediaFile[];
  title?: string;
  expiresAt?: string;
  onRefreshToken?: () => Promise<string | null>;
}

export function ImageGallery({ mediaFiles, title, expiresAt, onRefreshToken }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Force image re-render



  // Memoize sorted images to avoid recreating on every render
  const sortedImages = useMemo(() => {
    return [...mediaFiles].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [mediaFiles]);


  // Get current image based on currentIndex
  const currentImage = useMemo(() => sortedImages[currentIndex], [sortedImages, currentIndex]);


  // Reset currentIndex if out of bounds
  useEffect(() => {
    if (currentIndex >= sortedImages.length && sortedImages.length > 0) {
      setCurrentIndex(0);
    }
  }, [sortedImages.length, currentIndex]);

  // Memoize URLs to avoid regenerating on every render
  const imageUrls = useMemo(() => {
    return sortedImages.map((image) => {
      const previewUrl = MediaOptimizationUtils.getOptimizedUrl(image, 'preview');
      const thumbnailUrl = MediaOptimizationUtils.getOptimizedUrl(image, 'thumbnail');
      
      return {
        id: image._id,
        preview: convertMediaUrlToNextRoute(previewUrl) || previewUrl,
        thumbnail: convertMediaUrlToNextRoute(thumbnailUrl) || thumbnailUrl
      };
    });
  }, [sortedImages]);

  // Helper function to get memoized URL
  const getImageUrl = useCallback((index: number, type: 'preview' | 'thumbnail' = 'preview') => {
    const urlData = imageUrls[index];
    if (!urlData) {
      return '';
    }
    
    return urlData[type];
  }, [imageUrls]);

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
    setImageKey(prev => prev + 1);
  }, [sortedImages.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
    setImageKey(prev => prev + 1);
  }, [sortedImages.length]);

  const openModal = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsModalOpen(true);
  }, []);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setImageKey(prev => prev + 1);
  }, []);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Disable scroll when modal is open
  useEffect(() => {
    if (!isModalOpen || !mounted) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    
    return () => {
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
    };
  }, [isModalOpen, mounted]);

  // Keyboard navigation
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setIsModalOpen(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevImage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, prevImage, nextImage]);

  if (sortedImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">
          Không có hình ảnh
        </p>
      </div>
    );
  }

  // Single image
  if (sortedImages.length === 1) {
    const previewUrl = getImageUrl(0, 'preview');
    if (previewUrl) {
      return (
        <div className="space-y-3">
          <ImageViewer
            previewUrl={previewUrl}
            alt={title || currentImage.name || "Hình ảnh"}
            expiresAt={expiresAt || ""}
            onRefreshToken={onRefreshToken}
          />
          <div className="flex items-center justify-between">
            {/* Removed processing indicator for now */}
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {/* Gallery Grid */}
      <div className="space-y-4">
        {/* Main Image */}
        <div className="relative">
          <div 
            className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => openModal(currentIndex)}
          >
            <img
              key={`main-${currentIndex}-${currentImage?._id}-${imageKey}`}
              src={getImageUrl(currentIndex, 'preview')}
              alt={currentImage?.name || 'Hình ảnh'}
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Navigation Arrows */}
          {sortedImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </>
          )}
          
          {/* Image Counter */}
          <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            {currentIndex + 1} / {sortedImages.length}
          </div>
        </div>

        {/* Processing Indicator */}
        {/* Removed processing indicator for now */}

        {/* Thumbnail Strip */}
        {sortedImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sortedImages.map((image, index) => (
              <div key={image._id} className="relative flex-shrink-0">
                <button
                  onClick={() => handleThumbnailClick(index)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    index === currentIndex
                      ? 'border-primary'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <img
                    src={getImageUrl(index, 'thumbnail')}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              aria-label="Đóng"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            {/* Navigation */}
            {sortedImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Hình ảnh trước"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
                  aria-label="Hình ảnh tiếp theo"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </>
            )}
            
            {/* Image */}
            <img
              key={`modal-${currentIndex}-${currentImage?._id}-${imageKey}`}
              src={getImageUrl(currentIndex, 'preview')}
              alt={currentImage?.name || 'Hình ảnh'}
              className="max-w-full max-h-full object-contain cursor-pointer"
              onClick={() => setIsModalOpen(false)}
            />
            
            {/* Image Info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg">
              <p className="text-sm font-medium">{currentImage.name}</p>
              <p className="text-xs opacity-75">{currentIndex + 1} / {sortedImages.length}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}