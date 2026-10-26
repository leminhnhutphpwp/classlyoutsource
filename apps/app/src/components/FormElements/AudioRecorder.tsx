"use client";
import { useState, useRef, useEffect } from "react";
import { MicrophoneIcon, StopIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import apiClient from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatFileSize } from "@/lib/format-number";
import { getObjId } from "@/lib/id-utils";

interface AudioRecorderProps {
  onRecordingComplete: (mediaId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({
  onRecordingComplete,
  onError,
  disabled = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { addToast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ ghi âm. Vui lòng sử dụng trình duyệt khác.");
      }

      // Request microphone permission with audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Determine best supported mime type (priority: webm > mp4 > ogg > wav)
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else {
        // Fallback to default (browser will choose)
        mimeType = '';
      }

      // Create MediaRecorder with best supported format
      const mediaRecorder = new MediaRecorder(stream, mimeType ? {
        mimeType: mimeType,
      } : undefined);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the mime type from MediaRecorder if available, otherwise use detected type
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        const errorMessage = "Lỗi khi ghi âm. Vui lòng thử lại.";
        addToast({ type: "error", title: errorMessage });
        onError?.(errorMessage);
      };

      // Start recording with timeslice for better chunk handling (collect data every 1 second)
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer (limit to 5 minutes as per docs)
      const maxRecordingTime = 5 * 60; // 5 minutes
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto stop at max time
          if (newTime >= maxRecordingTime) {
            stopRecording();
            addToast({ type: "warning", title: "Đã đạt thời gian ghi âm tối đa (5 phút)" });
          }
          return newTime;
        });
      }, 1000);

      addToast({ type: "success", title: "Đã bắt đầu ghi âm" });
    } catch (error) {
      console.error("Error starting recording:", error);
      let errorMessage = "Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.";

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = "Quyền truy cập microphone bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.";
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = "Không tìm thấy microphone. Vui lòng kiểm tra thiết bị.";
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = "Microphone đang được sử dụng bởi ứng dụng khác. Vui lòng đóng ứng dụng khác và thử lại.";
        } else {
          errorMessage = error.message || errorMessage;
        }
      }

      addToast({ type: "error", title: errorMessage });
      onError?.(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      addToast({ type: "success", title: "Đã dừng ghi âm" });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setRecordedBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    addToast({ type: "success", title: "Đã xóa bản ghi âm" });
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const uploadAudio = async () => {
    if (!recordedBlob) return;

    try {
      setIsUploading(true);

      // Determine file extension based on mime type
      const mimeType = recordedBlob.type || 'audio/webm';
      let fileName = `recording-${Date.now()}.webm`;

      if (mimeType.includes('webm')) {
        fileName = `recording-${Date.now()}.webm`;
      } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        fileName = `recording-${Date.now()}.m4a`;
      } else if (mimeType.includes('ogg')) {
        fileName = `recording-${Date.now()}.ogg`;
      } else if (mimeType.includes('wav')) {
        fileName = `recording-${Date.now()}.wav`;
      }

      // Convert blob to file with correct extension
      const file = new File([recordedBlob], fileName, {
        type: mimeType,
      });

      // Validate file size (max 10MB as per docs)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`File quá lớn. Kích thước tối đa là ${formatFileSize(maxSize)}. File hiện tại: ${formatFileSize(file.size)}`);
      }

      // Upload to Media API with type 'audio'
      const response = await apiClient.uploadMediaFile(file, 'audio');

      if (response.success && getObjId(response.data)) {
        const mediaId = getObjId(response.data);
        onRecordingComplete(mediaId);
        addToast({ type: "success", title: "Upload ghi âm thành công" });
      } else {
        throw new Error(response.message || "Upload ghi âm thất bại");
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Lỗi khi upload ghi âm. Vui lòng thử lại.";
      addToast({ type: "error", title: errorMessage });
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Audio player (hidden) */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Recording controls */}
      {!recordedBlob && (
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MicrophoneIcon className="h-5 w-5" />
              Bắt đầu ghi âm
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(recordingTime)}
                </span>
              </div>
              {isPaused ? (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                >
                  <PlayIcon className="h-5 w-5" />
                  Tiếp tục
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-light px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary"
                >
                  Tạm dừng
                </button>
              )}
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                <StopIcon className="h-5 w-5" />
                Dừng ghi âm
              </button>
            </>
          )}
        </div>
      )}

      {/* Playback controls */}
      {recordedBlob && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {!isPlaying ? (
              <button
                type="button"
                onClick={playRecording}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                <PlayIcon className="h-5 w-5" />
                Nghe lại
              </button>
            ) : (
              <button
                type="button"
                onClick={stopPlaying}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                <StopIcon className="h-5 w-5" />
                Dừng phát
              </button>
            )}
            <button
              type="button"
              onClick={deleteRecording}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <TrashIcon className="h-5 w-5" />
              Xóa
            </button>
            <button
              type="button"
              onClick={uploadAudio}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang upload...
                </>
              ) : (
                <>
                  Upload ghi âm
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Thời lượng: {formatTime(recordingTime)}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {!recordedBlob
          ? "Nhấn 'Bắt đầu ghi âm' để bắt đầu ghi âm bài nộp của bạn"
          : "Bạn có thể nghe lại, xóa hoặc upload ghi âm"
        }
      </p>
    </div>
  );
}

