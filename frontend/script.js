document.addEventListener('DOMContentLoaded', () => {
    const correctPromptEl = document.getElementById('correct-prompt');
    const submissionAInput = document.getElementById('submission-a-file');
    const submissionBInput = document.getElementById('submission-b-file');
    const evaluateBtn = document.getElementById('evaluate-btn');
    
    const loadingLogsEl = document.getElementById('loading-logs');
    const logListEl = document.getElementById('log-list');
    const resultsContainerEl = document.getElementById('results-container');
    const awaitingAnalysisEl = document.getElementById('awaiting-analysis');
    
    const finalDecisionTitleEl = document.getElementById('final-decision-title');
    const finalDecisionTextEl = document.getElementById('final-decision-text');
    const submissionAResultsEl = document.getElementById('submission-a-results');
    const submissionBResultsEl = document.getElementById('submission-b-results');

    // --- CONFIGURATION ---
    const backendUrl = 'https://ai-evaluator-backend-h1wi.onrender.com/evaluate-files/';

    const updateFileName = (inputElement) => {
        const fileNameSpan = inputElement.nextElementSibling.querySelector('.file-name');
        if (inputElement.files.length > 0) {
            fileNameSpan.textContent = inputElement.files[0].name;
        } else {
            fileNameSpan.textContent = 'No file selected...';
        }
    };

    submissionAInput.addEventListener('change', () => updateFileName(submissionAInput));
    submissionBInput.addEventListener('change', () => updateFileName(submissionBInput));

    const showLoadingLog = (message, delay) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const li = document.createElement('li');
                li.textContent = message;
                li.style.animationDelay = `${logListEl.children.length * 100}ms`;
                logListEl.appendChild(li);
                resolve();
            }, delay);
        });
    };

    const renderResults = (data) => {
        // 1. Populate Summary
        finalDecisionTitleEl.textContent = data.decision_type === 'Trap Detected' ? 'Trap Detected' : 'Normal Comparison';
        finalDecisionTextEl.textContent = data.final_decision;
        
        // 2. Clear previous results
        submissionAResultsEl.innerHTML = '';
        submissionBResultsEl.innerHTML = '';

        // 3. Determine winner for badge display
        let winner = null;
        if (data.decision_type === 'Trap Detected') {
            winner = data.analysis.submission_a.some(f => f.score > 0) ? 'a' : 'b';
        } else {
            if (data.scores.submission_a_total > data.scores.submission_b_total) winner = 'a';
            if (data.scores.submission_b_total > data.scores.submission_a_total) winner = 'b';
        }

        // 4. Create Submission A card
        const cardA = createSubmissionCard('Submission A', data.analysis.submission_a, 'a', winner);
        submissionAResultsEl.appendChild(cardA);
        
        // 5. Create Submission B card
        const cardB = createSubmissionCard('Submission B', data.analysis.submission_b, 'b', winner);
        submissionBResultsEl.appendChild(cardB);
    };
    
    const createSubmissionCard = (title, analysis, submissionKey, winnerKey) => {
        const card = document.createElement('div');
        card.className = 'submission-card';
        
        const header = document.createElement('div');
        header.className = 'submission-header';
        
        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        
        const badge = document.createElement('span');
        badge.className = 'status-badge';

        if (winnerKey && submissionKey === winnerKey) {
            badge.textContent = 'Winner';
            badge.classList.add('status-winner');
        } else if (winnerKey) {
            badge.textContent = 'Rejected';
            badge.classList.add('status-rejected');
        } else {
             badge.textContent = 'Tie';
             badge.classList.add('status-winner'); // Or a neutral style
        }

        header.appendChild(titleEl);
        if(winnerKey) header.appendChild(badge);

        const featureList = document.createElement('div');
        featureList.className = 'feature-list';
        
        analysis.forEach(item => {
            const featureItem = document.createElement('div');
            featureItem.className = 'feature-item';
            
            const icon = document.createElement('div');
            icon.className = 'feature-icon';
            icon.textContent = item.score > 0 ? '✅' : '❌';
            
            const score = document.createElement('div');
            score.className = 'feature-score';
            score.textContent = `${item.score}/5`;
            if(item.score >= 4) score.classList.add('score-high');
            else if (item.score >= 1) score.classList.add('score-mid');
            else score.classList.add('score-low');
            
            const details = document.createElement('div');
            details.className = 'feature-details';
            
            const name = document.createElement('div');
            name.className = 'feature-name';
            name.textContent = item.feature;
            
            const reason = document.createElement('p');
            reason.className = 'feature-reason';
            reason.textContent = item.reason;

            details.appendChild(name);
            details.appendChild(reason);
            featureItem.appendChild(icon);
            featureItem.appendChild(details);
            featureItem.appendChild(score);
            featureList.appendChild(featureItem);
        });
        
        card.appendChild(header);
        card.appendChild(featureList);
        return card;
    };


    evaluateBtn.addEventListener('click', async () => {
        const correctPrompt = correctPromptEl.value;
        const submissionAFile = submissionAInput.files[0];
        const submissionBFile = submissionBInput.files[0];

        if (!correctPrompt || !submissionAFile || !submissionBFile) {
            alert('Error: Please provide a prompt and select both submission files.');
            return;
        }

        evaluateBtn.disabled = true;
        awaitingAnalysisEl.classList.add('hidden');
        resultsContainerEl.classList.add('hidden');
        loadingLogsEl.classList.remove('hidden');
        logListEl.innerHTML = '';
        
        try {
            await showLoadingLog('▶ Initializing analysis...', 0);

            const formData = new FormData();
            formData.append('correct_prompt', correctPrompt);
            formData.append('submission_a_file', submissionAFile);
            formData.append('submission_b_file', submissionBFile);
            
            await showLoadingLog('▶ Uploading submission files...', 500);
            await showLoadingLog('▶ Sending request to AI model...', 1000);

            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An unknown error occurred.');
            }
            
            await showLoadingLog('▶ Analysis complete. Rendering report...', 500);
            renderResults(data);

        } catch (error) {
            alert(`An error occurred: ${error.message}`);
        } finally {
            setTimeout(() => {
                loadingLogsEl.classList.add('hidden');
                resultsContainerEl.classList.remove('hidden');
                evaluateBtn.disabled = false;
            }, 500);
        }
    });
});