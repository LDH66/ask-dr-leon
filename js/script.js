// Dynamically refresh related topic pills with 5 options based on context
function updateRelatedTopics(queryKey) {
    const topicPillsContainer = document.getElementById('topicPills');
    if (!topicPillsContainer) return;

    let newPillsHTML = `<button class="pill-btn primary" data-topic="Tell me more">Tell me more (1 min)</button>`;

    if (queryKey.includes('vibe coding')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Game Dev Physics">Game Dev Physics</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
            <button class="pill-btn" data-topic="What is HTML?">What is HTML?</button>
        `;
    } else if (queryKey.includes('html') || queryKey.includes('css')) {
        newPillsHTML += `
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="What is Vibe Coding?">What is Vibe Coding?</button>
            <button class="pill-btn" data-topic="Responsive Design">Responsive Design</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
        `;
    } else {
        newPillsHTML += `
            <button class="pill-btn" data-topic="What is Vibe Coding?">What is Vibe Coding?</button>
            <button class="pill-btn" data-topic="4-Part Prompt Formula">4-Part Prompt Formula</button>
            <button class="pill-btn" data-topic="Connecting APIs">Connecting APIs</button>
            <button class="pill-btn" data-topic="Game Dev Physics">Game Dev Physics</button>
            <button class="pill-btn" data-topic="Media & Audio Sync">Media & Audio Sync</button>
        `;
    }

    topicPillsContainer.innerHTML = newPillsHTML;
    bindTopicPills(); 
}