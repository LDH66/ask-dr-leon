/**
 * ==========================================
 * SECTION 16: MOBILE AUTO-PLAY & GESTURE BYPASS FOR WEBRTC
 * ==========================================
 * Automatically unlocks media playback on iOS, Chrome, and Safari mobile browsers 
 * upon the user's first tap or click interaction.
 */
document.addEventListener('click', function unlockAudioAndVideo() {
    const audioEl = document.getElementById('simli-audio');
    const videoEl = document.getElementById('simli-video');
    
    if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().catch(() => {});
    }
    if (videoEl) {
        videoEl.play().catch(() => {});
    }

    // Force resume AudioContext for Chrome iOS WebKit web-audio pipelines
    if (window.AudioContext || window.webkitAudioContext) {
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (tempCtx.state === 'suspended') {
            tempCtx.resume();
        }
    }
    
    document.removeEventListener('click', unlockAudioAndVideo);
}, { once: true });