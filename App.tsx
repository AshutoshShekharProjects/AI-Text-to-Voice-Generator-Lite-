
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from './services/gemini';
import { decode, decodeAudioData, pcmToWav } from './utils/audio';
import { AudioVisualizer } from './components/AudioVisualizer';

const App: React.FC = () => {
  const [text, setText] = useState('Hello! Kyse ho aap');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedWavBlob, setGeneratedWavBlob] = useState<Blob | null>(null);

  // Voice refinement states (Generation)
  const [tone, setTone] = useState('natural');
  const [mood, setMood] = useState('neutral');
  const [speed, setSpeed] = useState('1.0x');

  // Local Playback speed state
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReferenceFile(e.target.files[0]);
      setError(null);
      setGeneratedWavBlob(null);
    }
  };

  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Source might already be stopped
      }
      currentSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Update playback rate dynamically if audio is playing
  useEffect(() => {
    if (currentSourceRef.current) {
      currentSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  const handleDownload = () => {
    if (!generatedWavBlob) return;
    const url = URL.createObjectURL(generatedWavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mimic_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateAndPlay = async () => {
    if (!referenceFile) {
      setError("Please upload a reference audio file first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedWavBlob(null);
    stopPlayback();

    try {
      const outputBase64 = await generateSpeech(text, referenceFile, { tone, mood, speed });
      const audioData = decode(outputBase64);

      // Create a downloadable WAV
      const wavBlob = pcmToWav(audioData, 24000);
      setGeneratedWavBlob(wavBlob);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      // Apply the current playback rate to the new source
      source.playbackRate.value = playbackRate;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        currentSourceRef.current = null;
      };

      currentSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Try a shorter, clearer audio clip.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#F5F4E8] border border-[#E2DFCE] rounded-3xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black bg-gradient-to-r from-[#708238] to-[#9AB048] bg-clip-text text-transparent mb-2">
            Voice Mimic AI
          </h1>
          <p className="text-[#787C6A]">Clone a voice and generate custom speech with full stylistic control.</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-[#3A3D32]">
              1. Upload Reference Voice (MP3, WAV, etc.)
            </label>
            <div className="relative group">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-[#787C6A]
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-full file:border-0
                  file:text-sm file:font-bold
                  file:bg-[#708238] file:text-white
                  hover:file:bg-[#5F6F30]
                  bg-[#FBFBF2] rounded-2xl border border-[#DCD9C9] p-2 cursor-pointer
                  transition-all"
              />
              {referenceFile && (
                <p className="mt-2 text-xs text-[#708238] font-bold">
                  ✓ {referenceFile.name} ready for mimicking
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-[#3A3D32]">
              2. Text to Speak
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-24 bg-[#FBFBF2] border border-[#DCD9C9] rounded-2xl p-4 text-[#3A3D32] focus:ring-2 focus:ring-[#708238] focus:border-transparent transition-all resize-none placeholder-[#A9A48E]"
              placeholder="Enter text here..."
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-[#3A3D32]">
              3. Refine Voice Characteristics
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-[#A9A48E] uppercase tracking-wider font-bold">Tone</span>
                <select 
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-[#FBFBF2] border border-[#DCD9C9] rounded-xl p-2.5 text-sm text-[#3A3D32] focus:ring-1 focus:ring-[#708238] outline-none"
                >
                  <option value="natural">Natural</option>
                  <option value="deep">Deep / Raspy</option>
                  <option value="high-pitched">High-Pitched</option>
                  <option value="warm">Warm / Soft</option>
                  <option value="bright">Bright / Energetic</option>
                  <option value="monotone">Monotone</option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-[#A9A48E] uppercase tracking-wider font-bold">Mood</span>
                <select 
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full bg-[#FBFBF2] border border-[#DCD9C9] rounded-xl p-2.5 text-sm text-[#3A3D32] focus:ring-1 focus:ring-[#708238] outline-none"
                >
                  <option value="neutral">Neutral</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="calm">Calm / Soothing</option>
                  <option value="sad">Sad / Low</option>
                  <option value="angry">Angry / Sharp</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="whispering">Whispering</option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-[#A9A48E] uppercase tracking-wider font-bold">Gen Speed</span>
                <select 
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="w-full bg-[#FBFBF2] border border-[#DCD9C9] rounded-xl p-2.5 text-sm text-[#3A3D32] focus:ring-1 focus:ring-[#708238] outline-none"
                >
                  <option value="0.75x">Slow (0.75x)</option>
                  <option value="1.0x">Normal (1.0x)</option>
                  <option value="1.25x">Fast (1.25x)</option>
                  <option value="1.5x">Very Fast (1.5x)</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#B2533E]/10 border border-[#B2533E]/50 text-[#B2533E] px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="pt-4 flex flex-col items-center gap-6">
            <div className="w-full flex gap-3">
              <button
                onClick={handleGenerateAndPlay}
                disabled={isLoading || !referenceFile}
                className={`flex-1 py-4 px-8 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] ${
                  isLoading || !referenceFile
                    ? 'bg-[#E8E6D9] text-[#A9A48E] cursor-not-allowed border border-[#DCD9C9]'
                    : 'bg-gradient-to-r from-[#708238] to-[#5F6F30] text-white shadow-lg shadow-[#708238]/30'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Generate & Play'
                )}
              </button>
              
              {generatedWavBlob && !isLoading && (
                <button
                  onClick={handleDownload}
                  className="bg-[#FBFBF2] hover:bg-[#F3F2EA] text-[#708238] p-4 rounded-2xl border border-[#DCD9C9] transition-all group relative"
                  title="Download Voice"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Local Playback Controls */}
            {generatedWavBlob && !isLoading && (
              <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#A9A48E] uppercase tracking-widest flex items-center gap-2">
                    Playback Speed
                    <span className="text-[#708238] font-mono text-sm">{playbackRate.toFixed(2)}x</span>
                  </label>
                  {isPlaying && (
                    <button
                      onClick={stopPlayback}
                      className="text-[#B2533E] hover:text-[#B2533E]/80 transition-colors text-xs uppercase tracking-widest font-bold flex items-center gap-1.5"
                    >
                      <div className="w-2 h-2 bg-[#B2533E] rounded-full animate-pulse" />
                      Stop
                    </button>
                  )}
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[#DCD9C9] rounded-lg appearance-none cursor-pointer accent-[#708238]"
                />
              </div>
            )}

            <AudioVisualizer isPlaying={isPlaying || isLoading} />
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#E2DFCE] text-center">
          <p className="text-xs text-[#A9A48E] max-w-sm mx-auto leading-relaxed">
            The <b>Gen Speed</b> setting influences the natural prosody during generation, while the <b>Playback Speed</b> slider adjusts the final audio output rate in your browser.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
