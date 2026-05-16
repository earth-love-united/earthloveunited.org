// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }


// ═══════════════════════════════════════════════════════
// GAIA VOICE ENGINE v1.0
// Client-side TTS using Web Speech API
// Bare metal. No API key. No network. Just speech.
// ═══════════════════════════════════════════════════════

const GaiaVoice = (() => {

  // ─── STATE ───
  let _voices = [];
  let _selectedVoice = null;
  let _ready = false;
  let _queue = [];
  let _speaking = false;
  let _enabled = true;
  let _rate = 0.85;     // slower than default — GAIA is unhurried
  let _pitch = 0.88;    // slightly lower — planetary, not human
  let _volume = 1.0;
  let _reverbEnabled = true;

  // ─── AUDIO CONTEXT (for reverb/processing) ───
  let _audioCtx = null;
  let _reverbNode = null;

  // ─── CALLBACKS ───
  let _callbacks = {
    onStart:  (text) => {},
    onEnd:    (text) => {},
    onError:  (err)  => {},
    onReady:  ()     => {}
  };

  // ═══════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════

  function init() {
    if (!('speechSynthesis' in window)) {
      console.warn('[GaiaVoice] Web Speech API not supported');
      return false;
    }

    // Load voices
    _loadVoices();

    // Some browsers load voices async
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = _loadVoices;
    }

    // Init audio context for processing (on first user interaction)
    document.addEventListener('click', _initAudioContext, { once: true });
    document.addEventListener('touchstart', _initAudioContext, { once: true });

    return true;
  }

  function _loadVoices() {
    _voices = speechSynthesis.getVoices();
    if (_voices.length > 0) {
      _selectBestVoice();
      _ready = true;
      _callbacks.onReady();
    }
  }

  function _selectBestVoice() {
    if (_voices.length === 0) return;

    // Priority order for GAIA's voice:
    // 1. Google US English (warm, slightly British-adjacent)
    // 2. Samantha (macOS — warm, slightly British)
    // 3. Google UK English Female
    // 4. Any English female voice
    // 5. Any English voice
    // 6. First available

    const priorities = [
      v => v.name.includes('Google') && v.name.includes('US') && v.name.includes('English'),
      v => v.name.includes('Samantha'),
      v => v.name.includes('Google') && v.name.includes('UK') && v.name.includes('Female'),
      v => v.name.includes('Google') && v.name.includes('English'),
      v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'),
      v => v.lang.startsWith('en'),
      v => true  // fallback: any voice
    ];

    for (const predicate of priorities) {
      const match = _voices.find(predicate);
      if (match) {
        _selectedVoice = match;
        console.log('[GaiaVoice] Selected voice:', match.name);
        return;
      }
    }
  }

  function _initAudioContext() {
    if (_audioCtx) return;

    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Create a simple reverb using convolver
      _reverbNode = _audioCtx.createConvolver();
      _reverbNode.buffer = _createReverbImpulse(_audioCtx, 2.5, 3.0);

      console.log('[GaiaVoice] Audio context initialized');
    } catch (e) {
      console.warn('[GaiaVoice] Audio context failed:', e);
    }
  }

  function _createReverbImpulse(ctx, duration, decay) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return impulse;
  }

  // ═══════════════════════════════════════
  // SPEAK
  // ═══════════════════════════════════════

  function speak(text, options = {}) {
    if (!_enabled || !text) return Promise.resolve();

    return new Promise((resolve, reject) => {
      if (!_ready) {
        // Queue for when ready
        _queue.push({ text, options, resolve, reject });
        return;
      }

      _doSpeak(text, options, resolve, reject);
    });
  }

  function _doSpeak(text, options, resolve, reject) {
    // Cancel current speech if interrupt requested
    if (options.interrupt) {
      stop();
    }

    // If already speaking, queue
    if (_speaking && !options.interrupt) {
      _queue.push({ text, options, resolve, reject });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Voice settings
    utterance.voice = _selectedVoice;
    utterance.rate = options.rate || _rate;
    utterance.pitch = options.pitch || _pitch;
    utterance.volume = options.volume || _volume;

    // Emotion-based adjustments
    if (options.emotion) {
      _applyEmotion(utterance, options.emotion);
    }

    // Events
    utterance.onstart = () => {
      _speaking = true;
      _callbacks.onStart(text);
    };

    utterance.onend = () => {
      _speaking = false;
      _callbacks.onEnd(text);
      resolve();
      _processQueue();
    };

    utterance.onerror = (e) => {
      _speaking = false;
      _callbacks.onError(e);
      reject(e);
      _processQueue();
    };

    // Speak
    speechSynthesis.speak(utterance);
  }

  function _processQueue() {
    if (_queue.length > 0 && !_speaking) {
      const next = _queue.shift();
      _doSpeak(next.text, next.options, next.resolve, next.reject);
    }
  }

  // ═══════════════════════════════════════
  // EMOTION PROCESSING
  // ═══════════════════════════════════════

  function _applyEmotion(utterance, emotion) {
    switch (emotion) {
      case 'curious':
        utterance.rate = _rate * 0.95;
        utterance.pitch = _pitch * 1.05;
        break;
      case 'excited':
        utterance.rate = _rate * 1.1;
        utterance.pitch = _pitch * 1.1;
        utterance.volume = Math.min(1, _volume * 1.1);
        break;
      case 'concerned':
        utterance.rate = _rate * 0.85;
        utterance.pitch = _pitch * 0.95;
        break;
      case 'proud':
        utterance.rate = _rate * 0.9;
        utterance.pitch = _pitch * 1.0;
        utterance.volume = Math.min(1, _volume * 1.05);
        break;
      case 'mysterious':
        utterance.rate = _rate * 0.8;
        utterance.pitch = _pitch * 0.9;
        utterance.volume = _volume * 0.9;
        break;
      case 'urgent':
        utterance.rate = _rate * 1.15;
        utterance.pitch = _pitch * 1.05;
        utterance.volume = Math.min(1, _volume * 1.1);
        break;
      case 'warm':
        utterance.rate = _rate * 0.88;
        utterance.pitch = _pitch * 0.95;
        break;
      case 'fierce':
        utterance.rate = _rate * 0.95;
        utterance.pitch = _pitch * 0.85;
        utterance.volume = Math.min(1, _volume * 1.15);
        break;
      case 'playful':
        utterance.rate = _rate * 1.05;
        utterance.pitch = _pitch * 1.1;
        break;
      case 'nurturing':
        utterance.rate = _rate * 0.82;
        utterance.pitch = _pitch * 0.92;
        utterance.volume = _volume * 0.95;
        break;
      case 'disappointed':
        utterance.rate = _rate * 0.78;
        utterance.pitch = _pitch * 0.88;
        utterance.volume = _volume * 0.85;
        break;
      default:
        // No adjustment
        break;
    }
  }

  // ═══════════════════════════════════════
  // PAUSE / RESUME / STOP
  // ═══════════════════════════════════════

  function pause() {
    speechSynthesis.pause();
  }

  function resume() {
    speechSynthesis.resume();
  }

  function stop() {
    speechSynthesis.cancel();
    _speaking = false;
    _queue = [];
  }

  function isSpeaking() {
    return _speaking;
  }

  function isPaused() {
    return speechSynthesis.paused;
  }

  // ═══════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════

  function setRate(rate) {
    _rate = Math.max(0.1, Math.min(2, rate));
  }

  function setPitch(pitch) {
    _pitch = Math.max(0, Math.min(2, pitch));
  }

  function setVolume(volume) {
    _volume = Math.max(0, Math.min(1, volume));
  }

  function setEnabled(enabled) {
    _enabled = enabled;
    if (!enabled) stop();
  }

  function setVoice(voiceName) {
    const voice = _voices.find(v => v.name === voiceName);
    if (voice) {
      _selectedVoice = voice;
      return true;
    }
    return false;
  }

  function getVoices() {
    return _voices.map(v => ({
      name: v.name,
      lang: v.lang,
      localService: v.localService
    }));
  }

  function getSelectedVoice() {
    return _selectedVoice?.name || null;
  }

  function setCallback(name, fn) {
    if (_callbacks.hasOwnProperty(name)) {
      _callbacks[name] = fn;
    }
  }

  // ═══════════════════════════════════════
  // UTILITY: SSML-LIKE PACING
  // ═══════════════════════════════════════

  // GAIA uses pauses for dramatic effect. This utility inserts
  // SSML-like break markers that the Web Speech API respects.
  function addPacing(text) {
    // Add pauses after ellipses
    text = text.replace(/\.\.\./g, '... <break time="800ms"/>');
    // Add pauses after em-dashes
    text = text.replace(/—/g, '— <break time="500ms"/>');
    // Add pauses after sentences that end with periods (for dramatic effect)
    text = text.replace(/\. ([A-Z])/g, '. <break time="400ms"/> $1');
    return text;
  }

  // Speak with automatic pacing applied
  function speakWithPacing(text, options = {}) {
    const paced = addPacing(text);
    return speak(paced, options);
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    init,
    speak,
    speakWithPacing,
    pause,
    resume,
    stop,
    isSpeaking,
    isPaused,
    setRate,
    setPitch,
    setVolume,
    setEnabled,
    setVoice,
    setCallback,
    getVoices,
    getSelectedVoice,
    addPacing,

    get ready() { return _ready; },
    get enabled() { return _enabled; },
    get queueLength() { return _queue.length; }
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaVoice;
if (typeof window !== 'undefined') window.GaiaVoice = GaiaVoice;
