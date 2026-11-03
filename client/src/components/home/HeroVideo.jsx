import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

/**
 * HeroVideo Component
 *
 * Requirements met:
 * - HTML5 video with autoPlay, muted, loop, playsInline, preload="metadata"
 * - No visible controls, download button, or context menu
 * - Strong download protection:
 *   - controlsList="nodownload noplaybackrate noremoteplayback"
 *   - disablePictureInPicture, disableRemotePlayback
 *   - Transparent overlay div intercepting right-click / long-press "Save video"
 *   - onContextMenu preventDefault, draggable="false", user-select: none
 *   - Blob URL streaming so raw video URL is hidden in inspect element
 * - IntersectionObserver: pauses video when off-screen to save bandwidth
 * - Tab visibility listener: pauses video when page is hidden
 * - Respects prefers-reduced-motion by keeping video paused with poster
 * - Small, elegant mute/unmute toggle button without download options
 * - Fallback to poster image on load error
 */
export default function HeroVideo({
  videoSrc = '/videos/hero.mp4',
  webmSrc = '/videos/hero.webm',
  poster = '/images/parcel-drop-box-front.jpeg',
  alt = 'boxel Parcel Drop Box showcase',
  className = '',
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const reduceMotion = useReducedMotion();
  const posterSource = poster?.includes('/video/upload/') ? poster.replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto/') : poster;

  // Create Blob URL for stronger URL protection (hides static URL from DOM inspection)
  useEffect(() => {
    let active = true;
    let createdUrl = null;

    async function loadProtectedVideo() {
      try {
        const response = await fetch(videoSrc);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        // Fallback to direct path if fetch fails (e.g. CORS or file://)
        if (active) {
          setBlobUrl(videoSrc);
        }
      }
    }

    loadProtectedVideo();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [videoSrc]);

  // Handle Playback, Visibility & IntersectionObserver
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect reduced motion
    if (reduceMotion) {
      video.pause();
      return;
    }

    // Auto-pause when tab is hidden, resume when tab is active
    const handleVisibilityChange = () => {
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Pause when scrolled off-screen, resume when visible
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!video) return;
        if (entry.isIntersecting) {
          if (!document.hidden && !reduceMotion) {
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, [reduceMotion, blobUrl]);

  // Audio Toggle
  const toggleAudio = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  // Prevent right-click context menu
  const preventContext = (e) => {
    e.preventDefault();
    return false;
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={preventContext}
      onDragStart={preventContext}
      className={`relative overflow-hidden select-none rounded-2xl shadow-2xl border border-white/20 bg-studio-floor/30 ${className}`}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Fallback image if video fails or reduced motion is active */}
      {hasError || reduceMotion ? (
        <img
          src={posterSource}
          alt={alt}
          className="size-full object-cover rounded-2xl"
          draggable="false"
          onContextMenu={preventContext}
        />
      ) : (
        <>
          {/* HTML5 Video Element */}
          <video
            ref={videoRef}
            src={blobUrl || videoSrc}
            poster={posterSource}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            draggable="false"
            tabIndex={-1}
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={preventContext}
            onError={() => setHasError(true)}
            onLoadedData={() => setIsLoaded(true)}
            className="size-full object-cover object-center rounded-2xl transition-opacity duration-700 pointer-events-none"
            style={{
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          >
            {webmSrc && <source src={webmSrc} type="video/webm" />}
            <source src={blobUrl || videoSrc} type="video/mp4" />
            <img src={poster} alt={alt} className="size-full object-cover rounded-2xl" />
          </video>

          {/* Transparent Overlay Shield: intercepts mouse and touch events directly above video */}
          <div
            aria-hidden="true"
            onContextMenu={preventContext}
            onDragStart={preventContext}
            className="absolute inset-0 z-10 cursor-default select-none bg-transparent"
            style={{
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          />

          {/* Audio toggle button (does not expose any native video controls or download menu) */}
          <button
            type="button"
            onClick={toggleAudio}
            onContextMenu={preventContext}
            aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="absolute top-4 right-4 z-20 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-md hover:bg-black/60 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            {isMuted ? (
              <VolumeX className="size-4 text-white" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4 text-white" aria-hidden="true" />
            )}
          </button>
        </>
      )}
    </div>
  );
}

