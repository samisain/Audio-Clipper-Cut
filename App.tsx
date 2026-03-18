import React, { useState, useRef } from 'react';
import { clipAudio } from './services/audioService';
import { UploadIcon, ScissorsIcon, DownloadIcon, ClockIcon, PlayIcon, MusicIcon, ZipIcon } from './components/Icon';
import Loader from './components/Loader';

declare global {
    interface Window {
        JSZip: any;
    }
}

interface ClippedSegment {
    src: string;
    name: string;
    start: number;
    end: number;
}

const App: React.FC = () => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [audioDuration, setAudioDuration] = useState<number>(0);
    const [clipDuration, setClipDuration] = useState<string>('30');
    const [clippedSegments, setClippedSegments] = useState<ClippedSegment[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isZipping, setIsZipping] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('audio/')) {
                setAudioFile(file);
                setAudioSrc(URL.createObjectURL(file));
                setClippedSegments([]);
                setError(null);
                setClipDuration('30');
            } else {
                setError('Please upload a valid audio file.');
            }
        }
    };

    const handleAudioMetadataLoaded = () => {
        if (audioRef.current) {
            const duration = audioRef.current.duration;
            setAudioDuration(duration);
        }
    };

    const handleClipAudio = async () => {
        if (!audioFile) {
            setError('Please upload an audio file first.');
            return;
        }

        const duration = parseFloat(clipDuration);

        if (isNaN(duration) || duration <= 0) {
            setError('Invalid clip duration. Please enter a positive number.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setClippedSegments([]);

        try {
            const segmentsToClip: { start: number, end: number }[] = [];
            for (let start = 0; start < audioDuration; start += duration) {
                const end = Math.min(start + duration, audioDuration);
                if (end - start > 0.1) {
                    segmentsToClip.push({ start, end });
                }
            }

            if (segmentsToClip.length === 0) {
                setError("No clips could be generated with the specified duration.");
                setIsLoading(false);
                return;
            }

            const clipPromises = segmentsToClip.map(seg => clipAudio(audioFile, seg.start, seg.end));
            const clippedBlobs = await Promise.all(clipPromises);

            const originalFileName = audioFile.name.split('.').slice(0, -1).join('.') || 'audio';

            const finalSegments = clippedBlobs.map((blob, index) => {
                const url = URL.createObjectURL(blob);
                const { start, end } = segmentsToClip[index];
                const name = `${originalFileName}_clip_${index + 1}_(${formatTime(start, false)}-${formatTime(end, false)}).wav`;
                return { src: url, name, start, end };
            });

            setClippedSegments(finalSegments);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during clipping.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownloadAllAsZip = async () => {
        if (!clippedSegments.length || !window.JSZip) {
            setError("JSZip library not found or no clips to download.");
            return;
        }

        setIsZipping(true);
        setError(null);

        try {
            const zip = new window.JSZip();

            const blobPromises = clippedSegments.map(segment =>
                fetch(segment.src).then(res => res.blob())
            );
            const blobs = await Promise.all(blobPromises);

            clippedSegments.forEach((segment, index) => {
                zip.file(segment.name, blobs[index]);
            });
            
            const originalFileName = audioFile?.name.split('.').slice(0, -1).join('.') || 'audio-clips';

            const zipContent = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipContent);
            link.download = `${originalFileName}_clips.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error("Error creating ZIP file:", err);
            setError(err instanceof Error ? err.message : "Failed to create ZIP file.");
        } finally {
            setIsZipping(false);
        }
    };

    const formatTime = (seconds: number, showMilliseconds: boolean = true): string => {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.round((seconds - Math.floor(seconds)) * 100);
        
        let timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        if (showMilliseconds) {
             timeString += `.${milliseconds.toString().padStart(2, '0')}`;
        }
        
        return timeString;
    };

    const isClipButtonDisabled = isLoading || isZipping || !audioFile || parseFloat(clipDuration) <= 0;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                        Audio Clipper AI
                    </h1>
                    <p className="text-gray-400 mt-2">Trim your audio files with precision in seconds.</p>
                </header>

                <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-blue-500/10 p-6 md:p-8 space-y-8">
                    {/* Step 1: Upload */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold flex items-center gap-3">
                            <span className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold">1</span>
                            Upload Audio File
                        </h2>
                        <div 
                            className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-700/50 transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                className="hidden"
                            />
                            <div className="flex flex-col items-center justify-center text-gray-400">
                                <UploadIcon className="w-12 h-12 mb-3" />
                                {audioFile ? (
                                    <span className="text-blue-300 font-medium">{audioFile.name}</span>
                                ) : (
                                    <span>Click to browse or drag & drop a file</span>
                                )}
                            </div>
                        </div>
                        {audioSrc && (
                             <div className="bg-gray-700/50 p-4 rounded-lg">
                                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><MusicIcon className="w-5 h-5"/>Original Audio</h3>
                                <audio
                                    ref={audioRef}
                                    src={audioSrc}
                                    controls
                                    className="w-full"
                                    onLoadedMetadata={handleAudioMetadataLoaded}
                                >
                                    Your browser does not support the audio element.
                                </audio>
                                <p className="text-right text-sm text-gray-400 mt-1">Total Duration: {formatTime(audioDuration, false)}</p>
                             </div>
                        )}
                    </div>

                    {/* Step 2: Clip */}
                    {audioSrc && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold flex items-center gap-3">
                                <span className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold">2</span>
                                Set Clip Duration
                            </h2>
                            <div className="relative">
                                <label htmlFor="clipDuration" className="block text-sm font-medium text-gray-300 mb-1">Clip Duration (s)</label>
                                <ClockIcon className="w-5 h-5 absolute left-3 top-9 text-gray-400" />
                                <input
                                    type="number"
                                    id="clipDuration"
                                    value={clipDuration}
                                    onChange={(e) => setClipDuration(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    placeholder="e.g., 30"
                                    step="1"
                                    min="1"
                                />
                            </div>
                            <button
                                onClick={handleClipAudio}
                                disabled={isClipButtonDisabled}
                                className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ${
                                    isClipButtonDisabled
                                        ? 'bg-gray-600 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 transform hover:scale-105'
                                }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader />
                                        Clipping...
                                    </>
                                ) : (
                                    <>
                                        <ScissorsIcon className="w-5 h-5" />
                                        Generate Clips
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                    
                    {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-lg text-center">{error}</p>}
                    
                    {/* Step 3: Result */}
                    {clippedSegments.length > 0 && (
                        <div className="space-y-4 animate-fade-in">
                             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                                <h2 className="text-2xl font-semibold flex items-center gap-3">
                                    <span className="bg-blue-500 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold">3</span>
                                    Your Clipped Segments
                                </h2>
                                <button
                                    onClick={handleDownloadAllAsZip}
                                    disabled={isZipping || isLoading}
                                    className={`flex-shrink-0 flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 ${
                                        (isZipping || isLoading)
                                            ? 'bg-gray-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transform hover:scale-105'
                                    }`}
                                >
                                    {isZipping ? (
                                        <>
                                            <Loader />
                                            Zipping...
                                        </>
                                    ) : (
                                        <>
                                            <ZipIcon className="w-5 h-5" />
                                            Download All (.zip)
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {clippedSegments.map((segment, index) => (
                                    <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                                            <h3 className="font-semibold text-lg flex items-center gap-2 text-blue-300">
                                                <PlayIcon className="w-5 h-5"/>
                                                Clip #{index + 1} 
                                                <span className="text-sm font-normal text-gray-400">({formatTime(segment.start, false)} - {formatTime(segment.end, false)})</span>
                                            </h3>
                                            <a
                                                href={segment.src}
                                                download={segment.name}
                                                className={`flex-shrink-0 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all transform hover:scale-105 ${isZipping ? 'opacity-50 pointer-events-none' : ''}`}
                                            >
                                                <DownloadIcon className="w-4 h-4" />
                                                Download
                                            </a>
                                        </div>
                                        <audio src={segment.src} controls className="w-full" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;