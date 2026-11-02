document.addEventListener('DOMContentLoaded', () => {
    setupSpeechRecognition();
    setupUIHandlers();
});

// Setup continuous automatic speech recognition (Hands-free mic)
function setupSpeechRecognition() {
    const micBtn = document.getElementById('micBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');
    const userInput = document.getElementById('userInput');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn("Speech Recognition API not supported in this browser.");
        if (micBtn) micBtn.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GB'; // British English
    recognition.interimResults = true;
    recognition.continuous = false; // Automatically stops when user stops speaking

    let isListening = false;

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (!isListening) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Recognition start error:", e);
                }
            } else {
                recognition.stop();
            }
        });
    }

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        if (listeningIndicator) {
            listeningIndicator.textContent = "Listening... Speak naturally (auto-stops when finished)";
            listeningIndicator.style.display = 'block';
        }
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        if (userInput) {
            userInput.value = transcript;
        }
    };

    recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        stopListeningState();
    };

    recognition.onend = () => {
        stopListeningState();
        const query = userInput ? userInput.value.trim() : '';
        if (query) {
            processUserQuery(query);
        }
    };

    function stopListeningState() {
        isListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        if (listeningIndicator) listeningIndicator.style.display = 'none';
    }
}

// Setup keyboard and click bindings for text input and topic buttons
function setupUIHandlers() {
    const submitBtn = document.getElementById('submitBtn');
    const userInput = document.getElementById('userInput');
    const topicPills = document.querySelectorAll('.pill-btn');

    if (submitBtn && userInput) {
        submitBtn.addEventListener('click', () => {
            const query = userInput.value.trim();
            if (query) processUserQuery(query);
        });

        // Pressing Enter stops/submits input immediately
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = userInput.value.trim();
                if (query) {
                    userInput.blur(); // Dismiss keyboard on mobile
                    processUserQuery(query);
                }
            }
        });
    }

    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.getAttribute('data-topic');
            if (userInput) userInput.value = topic;
            processUserQuery(topic);
        });
    });
}

// Process query and deliver expert answers in a British male voice
function processUserQuery(query) {
    const q = query.toLowerCase();
    let answerText = `Hello! Regarding your inquiry about ${query}, vibe coding enables you to direct software development seamlessly using intelligent prompts.`;

    if (q.includes('vibe coding')) {
        answerText = "Vibe coding represents a brilliant paradigm shift where you act as the visionary architect. Instead of writing boilerplate syntax line by line, you converse with AI to build, test, and deploy entire applications effortlessly.";
    } else if (q.includes('prompt formula') || q.includes('formula')) {
        answerText = "The four-part prompt formula consists of: First, defining a clear role for your AI. Second, providing rich context. Third, setting strict constraints. And fourth, specifying the precise output format you require.";
    } else if (q.includes('api') || q.includes('connecting')) {
        answerText = "Connecting APIs allows your frontend user interface to securely communicate with powerhouse backend services like OpenAI, managing authentication and data exchange smoothly behind the scenes.";
    } else if (q.includes('tell me more')) {
        answerText = "Welcome to the future of development! With Ask Dr Leon, you can combine modern serverless architecture, natural voice interactions, and AI prompt engineering to build production-ready applications in record time.";
    }

    speakBritishAnswer(answerText);
}

// Speak text aloud using a British English male voice
function speakBritishAnswer(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any overlapping audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';

    // Scan available voices for a British Male voice (e.g., UK English male, Oliver, Daniel, George, etc.)
    const voices = window.speechSynthesis.getVoices();
    const britishMaleVoice = voices.find(v => 
        v.lang === 'en-GB' && (v.name.toLowerCase().includes('male') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('Arthur') || v.name.includes('George'))
    ) || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));

    if (britishMaleVoice) {
        utterance.voice = britishMaleVoice;
    }

    utterance.rate = 1.0; 
    utterance.pitch = 0.95; // Slightly lower pitch for a natural male cadence
    
    window.speechSynthesis.speak(utterance);
}