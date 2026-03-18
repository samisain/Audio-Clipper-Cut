
// This module encapsulates the audio processing logic using the Web Audio API.

// A single, shared AudioContext is generally recommended.
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

/**
 * Clips an audio file between a start and end time.
 * @param file The audio file (e.g., from an <input type="file">).
 * @param startTime The start time of the clip in seconds.
 * @param endTime The end time of the clip in seconds.
 * @returns A promise that resolves with a Blob of the clipped audio in WAV format.
 */
export async function clipAudio(file: File, startTime: number, endTime: number): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const startOffset = Math.floor(startTime * originalBuffer.sampleRate);
  const endOffset = Math.floor(endTime * originalBuffer.sampleRate);
  const frameCount = endOffset - startOffset;

  if (frameCount <= 0) {
    throw new Error("Invalid time range: end time must be after start time.");
  }
  
  const clippedBuffer = audioContext.createBuffer(
    originalBuffer.numberOfChannels,
    frameCount,
    originalBuffer.sampleRate
  );

  for (let i = 0; i < originalBuffer.numberOfChannels; i++) {
    const channelData = originalBuffer.getChannelData(i);
    // Use subarray to get a view of the portion of the original data
    const clippedData = channelData.subarray(startOffset, endOffset);
    clippedBuffer.getChannelData(i).set(clippedData);
  }

  return bufferToWav(clippedBuffer);
}

/**
 * Converts an AudioBuffer to a WAV audio format Blob.
 * This function constructs a valid WAV file header and appends the raw PCM audio data.
 * @param buffer The AudioBuffer containing the audio data.
 * @returns A Blob representing the WAV file.
 */
function bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;

    const dataSize = buffer.length * numOfChan * bytesPerSample;
    const fileSize = dataSize + 44; // 44 bytes for the header

    const wavBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(wavBuffer);

    let offset = 0;

    // Helper to write string to DataView
    const writeString = (str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset++, str.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString('RIFF');
    view.setUint32(offset, fileSize - 8, true); offset += 4;
    writeString('WAVE');

    // "fmt " sub-chunk
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numOfChan * bytesPerSample, true); offset += 4; // ByteRate
    view.setUint16(offset, numOfChan * bytesPerSample, true); offset += 2; // BlockAlign
    view.setUint16(offset, bitDepth, true); offset += 2;

    // "data" sub-chunk
    writeString('data');
    view.setUint32(offset, dataSize, true); offset += 4;

    // Write the PCM data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < numOfChan; j++) {
            const sample = Math.max(-1, Math.min(1, channels[j][i]));
            // Convert to 16-bit integer
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}
