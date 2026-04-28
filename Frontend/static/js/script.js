document.addEventListener('DOMContentLoaded', () => {
            // --- THEME TOGGLE LOGIC ---
            const themeToggleBtn = document.getElementById('theme-toggle-btn');
            const sunIcon = document.getElementById('theme-icon-sun');
            const moonIcon = document.getElementById('theme-icon-moon');
            const body = document.body;

            function applyTheme(theme) {
                if (theme === 'dark') { body.classList.add('dark'); sunIcon.classList.remove('hidden'); moonIcon.classList.add('hidden'); } 
                else { body.classList.remove('dark'); sunIcon.classList.add('hidden'); moonIcon.classList.remove('hidden'); }
            }
            const savedTheme = localStorage.getItem('theme') || 'dark';
            applyTheme(savedTheme);

            themeToggleBtn.addEventListener('click', () => {
                const newTheme = body.classList.contains('dark') ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });


            // --- DOM ELEMENT REFERENCES ---
            const pages = { 
                landing: document.getElementById('landing-page'), 
                auth: document.getElementById('auth-page'), 
                choice: document.getElementById('choice-page'), 
                job_target: document.getElementById('job-target-page'), 
                input: document.getElementById('input-page'), 
                assessment: document.getElementById('assessment-page'), 
                careers: document.getElementById('careers-page'), 
                roadmap: document.getElementById('roadmap-page'), 
                comparison: document.getElementById('comparison-page'), 
                skill_gap: document.getElementById('skill-gap-page'), 
                interview: document.getElementById('interview-page'),
                future_scope: document.getElementById('future-scope-page'),
                project_pitch: document.getElementById('project-pitch-page') 
            };
            const jobPrepContainer = document.getElementById('job-prep-container');
            const backToChoiceBtn = document.getElementById('back-to-choice-btn');
            const loaders = {
                careers: document.getElementById('careers-loader'),
                roadmap: document.getElementById('roadmap-loader'),
                comparison: document.getElementById('comparison-loader'),
                futureScope: document.getElementById('future-scope-loader'),
                projectPitch: document.getElementById('project-pitch-loader'),
            };
            const appHeader = document.getElementById('app-header');
            const userEmailDisplay = document.getElementById('user-email');
            const getStartedBtn = document.getElementById('get-started-btn');
            const signinTab = document.getElementById('signin-tab');
            const signupTab = document.getElementById('signup-tab');
            const otpTab = document.getElementById('otp-tab');
            const signinForm = document.getElementById('signin-form');
            const signupForm = document.getElementById('signup-form');
            const otpForm = document.getElementById('otp-form');
            const otpPhoneStep = document.getElementById('otp-phone-step');
            const otpVerifyStep = document.getElementById('otp-verify-step');
            const sendOtpBtn = document.getElementById('send-otp-btn');
            const otpPhoneDisplay = document.getElementById('otp-phone-display');
            const authError = document.getElementById('auth-error');
            const inputForm = document.getElementById('input-form');
            const careersList = document.getElementById('careers-list');
            const careersSubtitle = document.getElementById('careers-subtitle');
            const roadmapContent = document.getElementById('roadmap-content');
            const roadmapTitle = document.getElementById('roadmap-title');
            const toggleCompareModeBtn = document.getElementById('toggle-compare-mode-btn');
            const viewComparisonBtn = document.getElementById('view-comparison-btn');
            const comparisonGrid = document.getElementById('comparison-grid');
            const startAssessmentBtn = document.getElementById('start-assessment-btn');
            const assessmentForm = document.getElementById('assessment-form');
            const cancelAssessmentBtn = document.getElementById('cancel-assessment-btn');
            const startInterviewBtnRoadmap = document.getElementById('start-interview-btn-roadmap');
            const skillGapTitle = document.getElementById('skill-gap-title');
            const skillGapForm = document.getElementById('skill-gap-form');
            const userSkillsInput = document.getElementById('user-skills-input');
            const skillGapResults = document.getElementById('skill-gap-results');
            const progressBarFill = document.getElementById('progress-bar-fill');
            const progressBarText = document.getElementById('progress-bar-text');
            const skillsHaveList = document.getElementById('skills-have-list');
            const skillsToLearnList = document.getElementById('skills-to-learn-list');
            const backToRoadmapFromGapBtn = document.getElementById('back-to-roadmap-from-gap-btn');
            const interviewTitle = document.getElementById('interview-title');
            const chatMessages = document.getElementById('chat-messages');
            const chatForm = document.getElementById('chat-form');
            const chatInput = document.getElementById('chat-input');
            const backToRoadmapFromInterviewBtn = document.getElementById('back-to-roadmap-from-interview-btn');
            const analyzeSkillsBtnRoadmap = document.getElementById('analyze-skills-btn-roadmap');
            const projectPitchTitle = document.getElementById('project-pitch-title');
            const projectPitchContent = document.getElementById('project-pitch-content');
            const backToRoadmapFromPitchBtn = document.getElementById('back-to-roadmap-from-pitch-btn');
            
            const jobTargetForm = document.getElementById('job-target-form');
            const backToChoiceFromTargetBtn = document.getElementById('back-to-choice-from-target-btn');

            const exportPdfBtn = document.getElementById('export-pdf-btn');
            const futureScopeBtn = document.getElementById('future-scope-btn');
            const futureScopeTitle = document.getElementById('future-scope-title');
            const futureScopeContent = document.getElementById('future-scope-content');
            const backToRoadmapFromScopeBtn = document.getElementById('back-to-roadmap-from-scope-btn');


            // --- STATE VARIABLES ---
            let currentUserEmail = null;
            let careersToCompare = new Set();
            let isCompareModeActive = false;
            let currentCareerForAnalysis = '';
            let currentRoadmapForAnalysis = null;
            let interviewConversation = [];
            let jobPrepTarget = {};


            // --- BACKEND CONNECTION ---
            // Replace with your actual URL
            const BASE_URL = 'http://127.0.0.1:5001';
            async function handleApiRequest(endpoint, method = 'POST', body = null) {
                const url = `${BASE_URL}${endpoint}`;
                const options = {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: body ? JSON.stringify(body) : null,
                };

                try {
                    const response = await fetch(url, options);
                    const responseData = await response.json();
                    if (!response.ok) {
                        throw new Error(responseData.error || `Server error: ${response.status}`);
                    }
                    return responseData;
                } catch (error) {
                    console.error(`API request to ${endpoint} failed:`, error);
                    authError.textContent = error.message;
                    authError.classList.remove('text-green-300');
                    authError.classList.add('text-pink-300');
                    Object.values(loaders).forEach(loader => loader.classList.add('hidden'));
                    throw error;
                }
            }
            
            // --- NAVIGATION & UI HELPERS ---
            function navigateTo(pageName) {
                jobPrepContainer.style.display = 'none';
                backToChoiceBtn.classList.add('hidden');

                if (pageName === 'landing') { 
                    document.body.style.background = 'var(--bg-landing)';
                    document.getElementById('theme-toggle-container').classList.remove('hidden'); 
                    appHeader.classList.add('hidden'); 
                } else { 
                    document.body.style.background = 'var(--bg-main-app)';
                    document.getElementById('theme-toggle-container').classList.add('hidden'); 
                    appHeader.classList.remove('hidden');
                }
                
                Object.values(pages).forEach(page => page.classList.remove('active'));
                if (pages[pageName]) { 
                    pages[pageName].classList.add('active'); 
                }
            }

            function showJobPrepDashboard() {
                Object.values(pages).forEach(page => page.classList.remove('active'));
                jobPrepContainer.style.display = 'flex';
                appHeader.classList.remove('hidden');
                backToChoiceBtn.classList.remove('hidden');
                document.body.style.background = 'var(--bg-main-app)';
                showJobPrepPage('dashboard');
            }

            function showJobPrepPage(targetPage) {
                document.querySelectorAll('.job-prep-page').forEach(p => p.classList.remove('active'));
                document.getElementById(`job-prep-${targetPage}-page`).classList.add('active');

                document.querySelectorAll('.sidebar-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.dataset.target === targetPage) {
                        link.classList.add('active');
                    }
                });
            }

            function setActiveTab(activeTab) {
                [signinTab, signupTab, otpTab].forEach(tab => tab.classList.remove('active'));
                activeTab.classList.add('active');
                signinForm.classList.toggle('hidden', activeTab !== signinTab);
                signupForm.classList.toggle('hidden', activeTab !== signupTab);
                otpForm.classList.toggle('hidden', activeTab !== otpTab);
            }

            function loginUser(identifier) {
                authError.textContent = '';
                currentUserEmail = identifier;
                userEmailDisplay.textContent = currentUserEmail;
                appHeader.classList.remove('hidden');
                navigateTo('choice');
            }

            // --- NEW: Simple Markdown to HTML converter ---
            function markdownToHtml(md) {
                // Headings
                md = md.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3" style="color: var(--text-primary);">$1</h2>');
                // Bold
                md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Bullets
                md = md.replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>');
                md = md.replace(/<\/li>\s?<li>/g, '</li><li>'); // clean up spacing
                md = `<ul>${md}</ul>`.replace(/<\/ul>([\s\S]*)<ul>/g, '$1'); // wrap lists
                // Tables
                md = md.replace(/\|(.+)\|/g, '</td><td>$1</td>').replace(/<\/td><td>/,'<th>').replace(/<\/td>\s*$/,'').replace(/^/,'<tr>').replace(/$/,'</tr>');
                md = md.replace(/<\/th><td>/g, '</th><th>').replace(/<\/tr>(\s*)<tr>/g, '</tr>$1<tr>');
                md = md.replace(/\|---/g, '</td></tr><tr class="hidden"><td>').replace(/---/g, ''); // ignore header separator
                md = `<table class="w-full text-left border-collapse">${md}</table>`;
                md = md.replace(/<tr>\s*<th>/g, '<thead><tr class="border-b border-gray-600"><th>').replace(/<\/th>\s*<\/tr>/, '</th></tr></thead><tbody>').replace(/<\/tr>\s*<\/table>/, '</tr></tbody></table>');

                return md.replace(/<p>|<\/p>/g, ""); // Clean up stray paragraph tags if any
            }

            // --- EVENT LISTENERS & LOGIC ---
            getStartedBtn.addEventListener('click', () => navigateTo('auth'));

            document.getElementById('choice-career-advice').addEventListener('click', () => {
                navigateTo('input');
            });
            
            document.getElementById('choice-job-prep').addEventListener('click', () => {
                navigateTo('job_target');
            });
            
            jobTargetForm.addEventListener('submit', (e) => {
                e.preventDefault();
                jobPrepTarget = {
                    role: document.getElementById('target-role').value,
                    companies: document.getElementById('target-companies').value,
                    experience: document.getElementById('experience-level').value,
                    skills: document.getElementById('skills-to-practice').value,
                };
                console.log("Job Preparation Target Set:", jobPrepTarget);
                showJobPrepDashboard();
            });
            
            backToChoiceFromTargetBtn.addEventListener('click', () => navigateTo('choice'));
            
            backToChoiceBtn.addEventListener('click', () => navigateTo('choice'));

            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    showJobPrepPage(link.dataset.target);
                });
            });

            signinTab.addEventListener('click', () => setActiveTab(signinTab));
            signupTab.addEventListener('click', () => setActiveTab(signupTab));
            otpTab.addEventListener('click', () => setActiveTab(otpTab));

            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;
                const submitBtn = e.target.querySelector('button[type="submit"]');
                authError.textContent = '';
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
                try {
                    await handleApiRequest('/signup', 'POST', { email, password });
                    authError.textContent = 'Account created! Please sign in.';
                    authError.classList.remove('text-pink-300');
                    authError.classList.add('text-green-300');
                    setActiveTab(signinTab);
                } catch (error) {
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account →';
                }
            });

            signinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signin-email').value;
                const password = document.getElementById('signin-password').value;
                const submitBtn = e.target.querySelector('button[type="submit"]');
                authError.textContent = '';
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing In...';
                try {
                    const data = await handleApiRequest('/signin', 'POST', { email, password });
                    loginUser(data.identifier);
                } catch (error) {
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In →';
                }
            });

            sendOtpBtn.addEventListener('click', async () => {
                const phone = document.getElementById('phone-number').value;
                if (!phone) {
                    authError.textContent = "Please enter a phone number.";
                    return;
                }
                authError.textContent = '';
                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = 'Sending...';
                try {
                    const data = await handleApiRequest('/send-otp', 'POST', { phone });
                    authError.textContent = data.message;
                    authError.classList.remove('text-pink-300');
                    authError.classList.add('text-green-300');
                    otpPhoneDisplay.textContent = phone;
                    otpPhoneStep.classList.add('hidden');
                    otpVerifyStep.classList.remove('hidden');
                } catch (error) {
                } finally {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = 'Send OTP';
                }
            });
            
            otpForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const phone = otpPhoneDisplay.textContent;
                const code = document.getElementById('otp-code').value;
                const submitBtn = e.target.querySelector('button[type="submit"]');
                authError.textContent = '';
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
                try {
                    const data = await handleApiRequest('/verify-otp', 'POST', { phone, code });
                    loginUser(data.identifier);
                } catch (error) {
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Verify & Sign In';
                }
            });
            
            document.getElementById('signout-btn').addEventListener('click', () => {
                currentUserEmail = null;
                appHeader.classList.add('hidden');
                jobPrepContainer.style.display = 'none';
                backToChoiceBtn.classList.add('hidden');
                navigateTo('landing');
            });

            inputForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                navigateTo('careers');
                careersList.innerHTML = '';
                loaders.careers.classList.remove('hidden');
                const formData = {
                    interests: document.getElementById('interests').value,
                    skills: document.getElementById('skills').value,
                    pace: document.getElementById('pace').value,
                    lifeGoals: Array.from(document.querySelectorAll('input[name="life-goal"]:checked')).map(cb => cb.value)
                };
                try {
                    const result = await handleApiRequest('/generate-careers', 'POST', formData);
                    displayCareerOptions(result);
                } catch (error) {
                } finally {
                    loaders.careers.classList.add('hidden');
                }
            });

            function displayCareerOptions(careers) {
                careersList.innerHTML = '';
                careers.forEach(career => {
                    const card = document.createElement('div');
                    card.className = 'career-card';
                    card.dataset.title = career.title;
                    card.innerHTML = `<h3 class="text-xl font-bold mb-2">${career.title}</h3><p class="opacity-80">${career.description}</p>`;
                    card.addEventListener('click', () => {
                        if (isCompareModeActive) {
                            if (careersToCompare.has(career.title)) { careersToCompare.delete(career.title); card.classList.remove('selected'); } 
                            else { careersToCompare.add(career.title); card.classList.add('selected'); }
                            updateCompareButtonVisibility();
                        } else {
                            fetchAndDisplayRoadmap(career.title);
                        }
                    });
                    careersList.appendChild(card);
                });
            }
            
            function updateCompareButtonVisibility() { viewComparisonBtn.classList.toggle('hidden', careersToCompare.size < 2); }
            
            async function fetchAndDisplayRoadmap(careerTitle) {
                currentCareerForAnalysis = careerTitle;
                navigateTo('roadmap');
                roadmapTitle.textContent = `Roadmap to Becoming a ${careerTitle}`;
                roadmapContent.innerHTML = '';
                loaders.roadmap.classList.remove('hidden');
                try {
                    const result = await handleApiRequest('/generate-roadmap', 'POST', { careerTitle });
                    currentRoadmapForAnalysis = result;
                    setTimeout(() => displayRoadmap(result), 0);
                } catch(e) { 
                } finally { 
                    loaders.roadmap.classList.add('hidden');
                }
            }

            async function displayRoadmap(roadmap) {
                roadmapContent.innerHTML = '';
                const cardBg = document.body.classList.contains('dark') ? '#FFFFFF0D' : '#FFFFFFB3';
                const inputBg = document.body.classList.contains('dark') ? '#00000033' : '#E5E7EBCC';
                const textPrimary = document.body.classList.contains('dark') ? '#FFFFFF' : '#111827';
                const textAccent = document.body.classList.contains('dark') ? '#22d3ee' : '#4f46e5';
                
                let mermaidSyntax = 'graph TD;\n\n';
                mermaidSyntax += `    classDef milestoneNode fill:${cardBg},stroke:${textAccent},stroke-width:1.5,color:${textPrimary},font-weight:bold,padding:15px,border-radius:10px;\n`;
                mermaidSyntax += `    classDef skillNode fill:${inputBg},stroke:${textAccent},stroke-width:1,color:${textPrimary},padding:10px,border-radius:8px;\n`;
                mermaidSyntax += `    linkStyle default stroke:${textAccent},stroke-width:1.5,stroke-dasharray:3 3;\n\n`;
                
                let mainLinkCounter = 0;

                roadmap.forEach((milestone, index) => {
                    const milestoneId = `M${index}`;
                    const milestoneTitle = milestone.title.replace(/"/g, '#quot;');
                    mermaidSyntax += `    ${milestoneId}("${milestoneTitle}");\n`;
                    mermaidSyntax += `    class ${milestoneId} milestoneNode;\n`;

                    if (index > 0) {
                        mermaidSyntax += `    M${index - 1} --> ${milestoneId};\n`;
                        mermaidSyntax += `    linkStyle ${mainLinkCounter} stroke:${textAccent},stroke-width:2,stroke-dasharray:none;\n`;
                        mainLinkCounter++;
                    }

                    milestone.skills.forEach((skill, skillIndex) => {
                        const skillId = `S_${index}_${skillIndex}`; 
                        const skillName = skill.name.replace(/"/g, '#quot;');
                        mermaidSyntax += `    ${skillId}("<a href='${skill.resource.link}' target='_blank' style='color:${textPrimary}'>${skillName}</a>");\n`;
                        mermaidSyntax += `    class ${skillId} skillNode;\n`;
                        mermaidSyntax += `    ${milestoneId} -.-> ${skillId};\n`;
                    });
                    mermaidSyntax += '\n';
                });
                
                roadmapContent.textContent = mermaidSyntax;
                roadmapContent.removeAttribute('data-processed');
                await window.mermaid.run({ nodes: [roadmapContent] });
            }
            
            async function fetchAndDisplayComparison() {
                navigateTo('comparison');
                loaders.comparison.classList.remove('hidden');
                comparisonGrid.innerHTML = '';

                try {
                    const careerTitles = Array.from(careersToCompare);
                    const allRoadmaps = await Promise.all(
                        careerTitles.map(title => handleApiRequest('/generate-roadmap', 'POST', { careerTitle: title }))
                    );

                    comparisonGrid.innerHTML = careerTitles.map((title, idx) => {
                        const roadmap = allRoadmaps[idx];
                        const milestonesHtml = roadmap.map((milestone, mIdx) => {
                            const skillsHtml = milestone.skills.map(skill => `
                                <div class="skill-item">
                                    <span class="opacity-90">${skill.name}</span>
                                    <a href="${skill.resource.link}" target="_blank" rel="noopener noreferrer" class="resource-link">
                                        <span>${skill.resource.name}</span>
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    </a>
                                </div>`).join('');
                            return `<div class="roadmap-milestone">
                                        <div class="milestone-icon">${getMilestoneIcon(milestone.title)}</div>
                                        <div class="milestone-content">
                                            <p class="font-semibold" style="color: var(--text-accent);">Milestone ${mIdx + 1}</p>
                                            <h4 class="text-lg font-bold mb-3">${milestone.title}</h4>
                                            <div class="space-y-2">${skillsHtml}</div>
                                        </div>
                                    </div>`;
                        }).join('');
                        return `<div class="comparison-column">
                                    <h3 class="text-2xl font-bold mb-6 text-center" style="color: var(--text-primary);">${title}</h3>
                                    <div class="roadmap-container">${milestonesHtml}</div>
                                </div>`;
                    }).join('');
                } catch(e) {
                } finally {
                    loaders.comparison.classList.add('hidden');
                }

                isCompareModeActive = false;
                careersToCompare.clear();
                toggleCompareModeBtn.textContent = "Compare Roadmaps";
                careersSubtitle.textContent = "Click a card to discover your roadmap.";
                document.getElementById('back-to-input-btn').classList.remove('hidden');
                document.querySelectorAll('.career-card').forEach(c => c.classList.remove('selected'));
                updateCompareButtonVisibility();
            }

            const getMilestoneIcon = (title) => {
                const accentColor = 'var(--text-accent)'; 
                const lowerTitle = title.toLowerCase();
                if (lowerTitle.includes('foundation') || lowerTitle.includes('knowledge')) return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${accentColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'></path><path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'></path></svg>`;
                if (lowerTitle.includes('mastery') || lowerTitle.includes('framework')) return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${accentColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 20v-6m4 6v-6m4 6v-6M4 20h16'/><path d='M4 10h16'/><path d='M10 4v6m4-6v6m-8 6h16'/></svg>`;
                if (lowerTitle.includes('advanced') || lowerTitle.includes('specialization')) return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${accentColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25'></path></svg>`;
                if (lowerTitle.includes('project') || lowerTitle.includes('portfolio')) return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${accentColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 7h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z'></path><path d='M5 12A2 2 0 0 1 7 10h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z'></path></svg>`;
                return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${accentColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><line x1='12' y1='8' x2='12' y2='16'></line><line x1='8' y1='12' x2='16' y2='12'></line></svg>`;
            };

            toggleCompareModeBtn.addEventListener('click', () => { isCompareModeActive = !isCompareModeActive; if (isCompareModeActive) { toggleCompareModeBtn.textContent = "Cancel Comparison"; careersSubtitle.textContent = "Select 2 or more careers to compare."; document.getElementById('back-to-input-btn').classList.add('hidden'); } else { toggleCompareModeBtn.textContent = "Compare Roadmaps"; careersSubtitle.textContent = "Click a card to discover your roadmap."; document.getElementById('back-to-input-btn').classList.remove('hidden'); careersToCompare.clear(); document.querySelectorAll('.career-card').forEach(c => c.classList.remove('selected')); updateCompareButtonVisibility(); } });
            startAssessmentBtn.addEventListener('click', () => navigateTo('assessment'));
            cancelAssessmentBtn.addEventListener('click', () => navigateTo('input'));
            
            assessmentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const answers = { q1: document.querySelector('input[name="q1"]:checked')?.value, q2: document.querySelector('input[name="q2"]:checked')?.value, q3: document.querySelector('input[name="q3"]:checked')?.value, q4: document.querySelector('input[name="q4"]:checked')?.value, q5: document.querySelector('input[name="q5"]:checked')?.value, };
                if (Object.values(answers).some(answer => !answer)) { alert("Please answer all questions."); return; }
                const submitBtn = assessmentForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true; submitBtn.textContent = 'Analyzing...';
                try {
                    const result = await handleApiRequest('/find-interests', 'POST', { answers });
                    document.getElementById('interests').value = result.interests;
                    navigateTo('input');
                } catch(e) {
                } finally {
                    submitBtn.disabled = false; submitBtn.textContent = 'Find My Interests';
                }
            });

            viewComparisonBtn.addEventListener('click', fetchAndDisplayComparison);
            document.getElementById('back-to-input-btn').addEventListener('click', () => navigateTo('input'));
            document.getElementById('back-to-careers-btn').addEventListener('click', () => navigateTo('careers'));
            document.getElementById('back-to-careers-from-compare-btn').addEventListener('click', () => navigateTo('careers'));
            
            analyzeSkillsBtnRoadmap.addEventListener('click', () => {
                skillGapTitle.textContent = `Skill Gap Analysis: ${currentCareerForAnalysis}`;
                skillGapResults.classList.add('hidden');
                userSkillsInput.value = document.getElementById('skills').value;
                navigateTo('skill_gap');
            });

            skillGapForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userSkillsRaw = userSkillsInput.value;
                if (!userSkillsRaw || !currentRoadmapForAnalysis) return;
                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Analyzing...';
                try {
                    const result = await handleApiRequest('/analyze-skills', 'POST', { userSkills: userSkillsRaw, roadmap: currentRoadmapForAnalysis });
                    progressBarFill.style.width = `${result.percentage}%`;
                    progressBarText.textContent = `${result.percentage}%`;
                    skillsHaveList.innerHTML = result.skillsHave.map(s => `<li class="skill-list-item">${s}</li>`).join('') || '<li class="opacity-50">No matching skills found.</li>';
                    skillsToLearnList.innerHTML = result.skillsToLearn.map(s => `<li class="skill-list-item">${s}</li>`).join('') || '<li class="opacity-50">You have all the skills!</li>';
                    skillGapResults.classList.remove('hidden');
                } catch(e) {
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Analyze My Skills';
                }
            });
            backToRoadmapFromGapBtn.addEventListener('click', () => navigateTo('roadmap'));

            startInterviewBtnRoadmap.addEventListener('click', () => startInterview(currentCareerForAnalysis));
            backToRoadmapFromInterviewBtn.addEventListener('click', () => navigateTo('roadmap'));
            
            exportPdfBtn.addEventListener('click', () => {
                window.print();
            });

            futureScopeBtn.addEventListener('click', async () => {
                navigateTo('future_scope'); // Navigate immediately
                futureScopeTitle.textContent = `Future Scope of ${currentCareerForAnalysis} in India`;
                futureScopeContent.innerHTML = '';
                loaders.futureScope.classList.remove('hidden');

                try {
                    const result = await handleApiRequest('/generate-future-scope', 'POST', { careerTitle: currentCareerForAnalysis });
                    futureScopeContent.innerHTML = markdownToHtml(result.scope);
                } catch (e) {
                    futureScopeContent.textContent = "Sorry, we couldn't fetch the future scope analysis at this time. Please try again later.";
                } finally {
                    loaders.futureScope.classList.add('hidden');
                }
            });

            backToRoadmapFromScopeBtn.addEventListener('click', () => navigateTo('roadmap'));


            async function startInterview(careerTitle) {
                navigateTo('interview');
                interviewTitle.textContent = `Mock Interview: ${careerTitle}`;
                chatMessages.innerHTML = '';
                interviewConversation = [];
                const typingIndicator = showTypingIndicator();
                try {
                    const response = await handleApiRequest('/start-interview', 'POST', { careerTitle });
                    chatMessages.removeChild(typingIndicator);
                    addMessageToChat('ai', response.greeting);
                    interviewConversation.push({role: 'model', parts: [{ text: response.greeting }] });
                } catch (e) {
                    if (chatMessages.contains(typingIndicator)) chatMessages.removeChild(typingIndicator);
                }
            }

            function addMessageToChat(sender, text) {
                const messageElement = document.createElement('div');
                messageElement.className = `chat-bubble ${sender}`;
                messageElement.textContent = text;
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            function showTypingIndicator() {
                const typingElement = document.createElement('div');
                typingElement.className = 'typing-indicator';
                typingElement.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
                chatMessages.appendChild(typingElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                return typingElement;
            }

            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userInput = chatInput.value.trim();
                if (!userInput) return;
                
                addMessageToChat('user', userInput);
                chatInput.value = '';
                interviewConversation.push({role: 'user', parts: [{ text: userInput }] });
                
                const typingIndicator = showTypingIndicator();
                try {
                    const response = await handleApiRequest('/continue-interview', 'POST', { careerTitle: currentCareerForAnalysis, conversation: interviewConversation });
                    chatMessages.removeChild(typingIndicator);
                    addMessageToChat('ai', response.text);
                    interviewConversation.push({role: 'model', parts: [{ text: response.text }] });
                } catch (e) {
                     if (chatMessages.contains(typingIndicator)) chatMessages.removeChild(typingIndicator);
                }
            });

            async function fetchAndDisplayProjectPitch(milestoneTitle, skills) {
                navigateTo('project_pitch');
                projectPitchTitle.textContent = `Project Idea for: ${milestoneTitle}`;
                projectPitchContent.innerHTML = '';
                loaders.projectPitch.classList.remove('hidden');
                
                try {
                    const interests = document.getElementById('interests').value || 'general topics';
                    const result = await handleApiRequest('/generate-project-pitch', 'POST', { interests, skills, milestoneTitle });
                    projectPitchContent.textContent = result.pitch;
                } catch (e) {
                } finally {
                    loaders.projectPitch.classList.add('hidden');
                }
            }

            backToRoadmapFromPitchBtn.addEventListener('click', () => navigateTo('roadmap'));
            
            navigateTo('landing');
        });