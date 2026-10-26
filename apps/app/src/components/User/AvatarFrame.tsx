import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarFrameProps {
  level?: number;
  className?: string;
  children: React.ReactNode;
}

// Define frame styles based on level
const getFrameStyle = (level: number) => {
  switch (level) {
    case 1:
      // Bronze / Basic - Warm bronze with elegant shine
      return {
        containerClass: "animate-subtle-pulse",
        badgeClass: "bg-amber-700 text-white",
        conrStyle: {
          background: "linear-gradient(135deg, #CD7F32 0%, #B8860B 50%, #8B6914 100%)",
          boxShadow: "0 0 0 1px rgba(184, 134, 11, 0.3), 0 2px 8px rgba(184, 134, 11, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.2)"
        },
        badgeStyle: {}
      };
    case 2:
      // Silver / Intermediate - Vibrant orange with energetic shine
      return {
        containerClass: "animate-shimmer",
        badgeClass: "bg-orange-600 text-white",
        containerStyle: {
          background: "linear-gradient(135deg, #FDBA74 0%, #FB923C 50%, #F97316 100%)",
          boxShadow: "0 0 0 1px rgba(251, 146, 60, 0.3), 0 2px 10px rgba(251, 146, 60, 0.3), inset 0 1px 3px rgba(255, 255, 255, 0.4)"
        },
        badgeStyle: {}
      };
    case 3:
      // Gold / Pro - Luxurious gold with royal elegance
      return {
        containerClass: "animate-gold-glow",
        badgeClass: "text-amber-900 border border-yellow-300",
        containerStyle: {
          background: "linear-gradient(135deg, #FFD700 0%, #F1C40F 50%, #D4AF37 100%)",
          boxShadow: "0 0 0 1px rgba(241, 196, 15, 0.3), 0 3px 12px rgba(241, 196, 15, 0.35), inset 0 1px 3px rgba(255, 255, 255, 0.35)"
        },
        badgeStyle: {
          backgroundColor: "#F1C40F",
          boxShadow: "0 2px 6px rgba(241, 196, 15, 0.35)"
        }
      };
    default:
      return { containerClass: "", badgeClass: "", containerStyle: {}, badgeStyle: {} };
  }
};

export const AvatarFrame: React.FC<AvatarFrameProps> = ({ 
  level: rawLevel = 0, 
  className, 
  children
}) => {
  // Ensure level is a number
  const level = typeof rawLevel === 'string' ? parseInt(rawLevel, 10) : rawLevel;

  // If no level or level 0, just render children without frame
  if (!level || level < 1 || isNaN(level)) {
    return <>{children}</>;
  }

  const styles = getFrameStyle(level);

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center rounded-full p-[3px]", 
        styles.containerClass,
        className
      )}
      style={styles.containerStyle}
    >
      {/* Rotating ring effect - only for level 2 and 3 */}
      {level >= 2 && (
        <div 
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background: level === 2 
              ? 'conic-gradient(from 0deg, transparent 0%, rgba(251, 146, 60, 0.8) 10%, transparent 20%, transparent 100%)'
              : 'conic-gradient(from 0deg, transparent 0%, rgba(241, 196, 15, 0.8) 10%, transparent 20%, transparent 100%)',
            filter: 'blur(4px)',
            pointerEvents: 'none'
          }}
        />
      )}
      
      {/* Inner background to separate frame from avatar if needed, or just render children */}
      <div className="relative rounded-full bg-white p-[2px] dark:bg-dark-2">
        {children}
      </div>
    </div>
  );
};

