export type AudioEngine = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  getFrequency: () => Uint8Array;
  connectFile: (file: File) => Promise<void>;
  connectMic: () => Promise<void>;
  stop: () => void;
};

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  const data = new Uint8Array(analyser.frequencyBinCount);

  let source: AudioNode | null = null;
  let mediaStream: MediaStream | null = null;
  let bufferSource: AudioBufferSourceNode | null = null;

  const disconnectSource = () => {
    if (bufferSource) {
      try {
        bufferSource.stop();
      } catch {
        /* already stopped */
      }
      bufferSource.disconnect();
      bufferSource = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  };

  return {
    ctx,
    analyser,
    getFrequency: () => {
      analyser.getByteFrequencyData(data);
      return data;
    },
    connectFile: async (file: File) => {
      disconnectSource();
      if (ctx.state == 'suspended') await ctx.resume();
      const buf = await file.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audioBuf;
      bufferSource.loop = true;
      bufferSource.connect(analyser);
      analyser.connect(ctx.destination);
      bufferSource.start(0);
      source = bufferSource;
    },
    connectMic: async () => {
      disconnectSource();
      if (ctx.state == 'suspended') await ctx.resume();
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mic = ctx.createMediaStreamSource(mediaStream);
      mic.connect(analyser);
      // 麦不接到 destination，避免回授
      source = mic;
    },
    stop: () => {
      disconnectSource();
    },
  };
}
