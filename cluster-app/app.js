// Palette for up to 15 clusters
const CLUSTER_COLORS = [
    'rgba(56, 189, 248, 0.8)',   // Sky Blue
    'rgba(249, 115, 22, 0.8)',   // Bright Orange
    'rgba(16, 185, 129, 0.8)',   // Emerald Green
    'rgba(236, 72, 153, 0.8)',   // Hot Pink
    'rgba(234, 179, 8, 0.8)',    // Yellow
    'rgba(139, 92, 246, 0.8)',   // Purple
    'rgba(6, 182, 212, 0.8)',    // Cyan
    'rgba(239, 68, 68, 0.8)',    // Red
    'rgba(132, 204, 22, 0.8)',   // Lime
    'rgba(217, 70, 239, 0.8)',   // Fuchsia
    'rgba(20, 184, 166, 0.8)',   // Teal
    'rgba(99, 102, 241, 0.8)',   // Indigo
    'rgba(168, 85, 247, 0.8)',   // Violet
    'rgba(244, 63, 94, 0.8)',    // Rose
    'rgba(252, 211, 77, 0.8)'    // Glowing Yellow
];

let chart;
let currentK = 5;
let xAxisFeature = 'energy';
let yAxisFeature = 'danceability';
let zAxisFeature = 'loudness';
let currentTab = 'home';
let currentAssignments = [];
let pcaResult = null;
let isPCA = false;
let elbowChartInstance;
let silhouetteChartInstance;

const loader = document.getElementById('loader');
const kDisplay = document.getElementById('k-display');
const kSlider = document.getElementById('k-slider');
const xSelect = document.getElementById('x-axis');
const ySelect = document.getElementById('y-axis');
const zSelect = document.getElementById('z-axis');
const zAxisGroup = document.getElementById('z-axis-group');
const tabBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-content');
const ctx = document.getElementById('clusterChart').getContext('2d');

function init() {
    if (!musicData || !musicData.data || musicData.data.length === 0) {
        loader.textContent = "Failed to load data. Please run prepare_data.py";
        return;
    }
    
    // Populate Selects
    musicData.features.forEach(f => {
        let optX = new Option(f, f);
        let optY = new Option(f, f);
        let optZ = new Option(f, f);
        if (f === xAxisFeature) optX.selected = true;
        if (f === yAxisFeature) optY.selected = true;
        if (f === zAxisFeature) optZ.selected = true;
        xSelect.add(optX);
        ySelect.add(optY);
        if(zSelect) zSelect.add(optZ);
    });

    // Setup Custom Dropdowns
    setupCustomDropdown(xSelect);
    setupCustomDropdown(ySelect);
    if(zSelect) setupCustomDropdown(zSelect);
    
    // Event Listeners
    kSlider.addEventListener('input', (e) => {
        currentK = parseInt(e.target.value);
        kDisplay.textContent = currentK;
    });
    
    kSlider.addEventListener('change', () => {
        recalculateClusters();
    });
    
    xSelect.addEventListener('change', (e) => {
        xAxisFeature = e.target.value;
        updateChartData();
    });
    
    ySelect.addEventListener('change', (e) => {
        yAxisFeature = e.target.value;
        updateChartData();
    });

    if (zSelect) {
        zSelect.addEventListener('change', (e) => {
            zAxisFeature = e.target.value;
            updateChartData();
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('fade-enter');
            });
            
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            const targetView = document.getElementById(`view-${currentTab}`);
            if(targetView) {
                targetView.classList.remove('hidden');
                // trigger reflow
                void targetView.offsetWidth;
                targetView.classList.add('fade-enter');
            }
            
            const sidebarControls = document.getElementById('sidebar-controls');
            const sharedSongs = document.getElementById('shared-songs-container');
            
            if (currentTab === 'about' || currentTab === 'home') {
                if(sidebarControls) sidebarControls.style.display = 'none';
                if(sharedSongs) sharedSongs.classList.add('hidden');
            } else {
                if(sidebarControls) sidebarControls.style.display = 'flex';
                if(sharedSongs) sharedSongs.classList.remove('hidden');
                
                if (currentTab === '3d') {
                    if(zAxisGroup) zAxisGroup.classList.remove('hidden');
                } else {
                    if(zAxisGroup) zAxisGroup.classList.add('hidden');
                }
                
                updateChartData();
            }
        });
    });

    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const mainSidebar = document.getElementById('main-sidebar');
    if (toggleSidebarBtn && mainSidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            mainSidebar.classList.toggle('collapsed');
            // Redraw charts after transition to ensure correct resizing
            setTimeout(() => {
                if (currentTab === '2d' && chart) chart.resize();
                if (currentTab === '3d' && document.getElementById('plotly3d')) {
                    Plotly.Plots.resize(document.getElementById('plotly3d'));
                }
            }, 300);
        });
    }
    
    const evaluateBtn = document.getElementById('evaluate-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const evalModal = document.getElementById('eval-modal');
    
    if (evaluateBtn) {
        evaluateBtn.addEventListener('click', () => {
            evalModal.classList.remove('hidden');
            runEvaluation();
        });
    }

    const startClusteringBtn = document.getElementById('start-clustering-btn');
    if (startClusteringBtn) {
        startClusteringBtn.addEventListener('click', () => {
            const tab2d = document.querySelector('.nav-btn[data-tab="2d"]');
            if (tab2d) tab2d.click();
        });
    }
    
    const footerAboutLink = document.getElementById('footer-about-link');
    if (footerAboutLink) {
        footerAboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            const aboutBtn = document.querySelector('.nav-btn[data-tab="about"]');
            if (aboutBtn) aboutBtn.click();
        });
    }

    // Easter Egg Navigation
    function showHiddenView(viewId) {
        const currentViewElement = document.getElementById(`view-${currentTab}`);
        const nextViewElement = document.getElementById(viewId);
        
        if (currentViewElement) {
            currentViewElement.classList.remove('active');
            currentViewElement.classList.add('hidden');
        }
        
        if (nextViewElement) {
            nextViewElement.classList.remove('hidden');
            void nextViewElement.offsetWidth; // Reflow
            nextViewElement.classList.add('active');
            nextViewElement.classList.add('fade-in');
        }
        
        currentTab = viewId.replace('view-', '');
        
        const controls = document.getElementById('sidebar-controls');
        if (controls) controls.classList.remove('show');
        const mainSidebar = document.getElementById('main-sidebar');
        if (mainSidebar) mainSidebar.classList.add('collapsed');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    }

    const footerFeaturesLink = document.getElementById('footer-features-link');
    if (footerFeaturesLink) {
        footerFeaturesLink.addEventListener('click', (e) => {
            e.preventDefault();
            const btn3d = document.querySelector('.nav-btn[data-tab="3d"]');
            if (btn3d) btn3d.click();
        });
    }

    const footerPrivacyLink = document.getElementById('footer-privacy-link');
    if (footerPrivacyLink) {
        footerPrivacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            showHiddenView('view-privacy');
        });
    }

    const footerContactLink = document.getElementById('footer-contact-link');
    if (footerContactLink) {
        footerContactLink.addEventListener('click', (e) => {
            e.preventDefault();
            showHiddenView('view-contact');
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            evalModal.classList.add('hidden');
        });
    }
    
    loader.style.opacity = '0';
    
    const analyzeInsightBtn = document.getElementById('analyze-insight-btn');
    if (analyzeInsightBtn) {
        analyzeInsightBtn.addEventListener('click', () => {
            triggerPairingSearch('x', xAxisFeature);
        });
    }

    // Setup Toggle for Algorithms
    const btnKMeans = document.getElementById('btn-kmeans');
    const btnPca = document.getElementById('btn-pca');
    const indicator = document.querySelector('.algo-indicator');
    const axisControls = document.getElementById('axis-controls');
    const insightBox = document.getElementById('insight-box');
    const pcaInsightsBox = document.getElementById('pca-insights-box');

    if (btnKMeans && btnPca && indicator && axisControls) {
        btnKMeans.addEventListener('click', () => {
            if (!isPCA) return;
            isPCA = false;
            btnKMeans.classList.add('active');
            btnPca.classList.remove('active');
            indicator.style.transform = 'translateX(0)';
            axisControls.classList.remove('collapsed');
            if (insightBox) insightBox.classList.remove('hidden');
            if (pcaInsightsBox) pcaInsightsBox.classList.add('hidden');
            updateChartData();
        });

        btnPca.addEventListener('click', () => {
            if (isPCA) return;
            isPCA = true;
            btnPca.classList.add('active');
            btnKMeans.classList.remove('active');
            indicator.style.transform = 'translateX(100%)';
            axisControls.classList.add('collapsed');
            if (insightBox) insightBox.classList.add('hidden');
            if (pcaInsightsBox) {
                pcaInsightsBox.classList.remove('hidden');
                updatePCAInsights();
            }
            updateChartData();
        });
    }

    // Precompute PCA
    const scaledDataset = musicData.data.map(d => d.scaled);
    if (typeof computePCA === 'function') {
        pcaResult = computePCA(scaledDataset, 3);
    }

    // Initial Calculation
    recalculateClusters();
}

function updatePCAInsights() {
    if (!pcaResult) return;
    const is3D = currentTab === '3d';
    const numComps = is3D ? 3 : 2;
    
    // Variance
    let explainedSum = 0;
    for (let i = 0; i < numComps; i++) {
        explainedSum += pcaResult.eigenvalues[i];
    }
    const varPercent = (explainedSum / pcaResult.totalVariance) * 100;
    
    const varText = document.getElementById('pca-variance-text');
    if (varText) {
        varText.innerHTML = `<strong>Explained Variance:</strong> The current ${numComps} Principal Components capture <strong>${varPercent.toFixed(1)}%</strong> of the total information from all 9 features.`;
    }
    
    // Loadings
    const loadingsText = document.getElementById('pca-loadings-text');
    if (loadingsText) {
        let html = `<strong>Top Feature Drivers:</strong><div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.75rem;">`;
        for (let i = 0; i < numComps; i++) {
            const vector = pcaResult.eigenvectors[i];
            
            // Map weights and sort
            let weights = musicData.features.map((f, idx) => ({ 
                feature: f.charAt(0).toUpperCase() + f.slice(1), // Capitalize
                weight: Math.abs(vector[idx]), 
                realWeight: vector[idx] 
            }));
            weights.sort((a, b) => b.weight - a.weight);
            
            const topFeatures = weights.slice(0, 3);
            const maxWeight = topFeatures[0].weight || 1;
            
            html += `<div>
                <strong style="color: #60a5fa; font-size: 0.9rem;">PC${i+1}</strong>
                <div style="margin-top: 0.4rem; display:flex; flex-direction:column; gap:0.4rem;">`;
            
            topFeatures.forEach(w => {
                const barWidth = (w.weight / maxWeight) * 100;
                const isPositive = w.realWeight > 0;
                const barColor = isPositive ? '#10b981' : '#f43f5e'; // Emerald for +, Rose for -
                const dirText = isPositive ? '+' : '-';
                
                html += `
                <div style="display:flex; align-items:center; font-size:0.75rem;">
                    <span style="width: 85px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color: #cbd5e1;">${w.feature}</span>
                    <div style="flex:1; height: 6px; background: rgba(255,255,255,0.05); border-radius:3px; margin: 0 0.5rem; overflow:hidden;">
                        <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; border-radius:3px;"></div>
                    </div>
                    <span style="width: 20px; text-align:right; font-weight: bold; color: ${barColor};">${dirText}</span>
                </div>`;
            });
            
            html += `</div></div>`;
        }
        html += `</div>`;
        loadingsText.innerHTML = html;
    }
}

function recalculateClusters() {
    try {
        const dataset = musicData.data.map(d => d.scaled);
        
        console.time("KMeans");
        currentAssignments = kmeans(dataset, currentK, 50);
        console.timeEnd("KMeans");
        updateChartData();
    } catch(err) {
        console.timeEnd("KMeans"); // prevent timer warning loop
        console.error("Error in recalculateClusters:", err);
        loader.textContent = "Error: " + err.message + " | Stack: " + err.stack.toString().substring(0, 100);
        loader.style.opacity = '1';
        loader.style.color = 'red';
    }
}

function updateChartData() {
    const datasets = [];
    
    // Initialize empty arrays for each cluster
    for (let c = 0; c < currentK; c++) {
        datasets.push({
            label: `Cluster ${c+1}`,
            data: [],
            backgroundColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
            borderColor: 'transparent',
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: 0
        });
    }
    
    // Populate datasets based on selected axes
    for (let i = 0; i < musicData.data.length; i++) {
        const item = musicData.data[i];
        const clusterIdx = currentAssignments[i];
        
        // Use raw original values for display, or PCA coordinates
        datasets[clusterIdx].data.push({
            x: isPCA ? pcaResult.projectedData[i][0] : item.original[xAxisFeature],
            y: isPCA ? pcaResult.projectedData[i][1] : item.original[yAxisFeature],
            rawItem: item
        });
    }
    
    if (chart) {
        chart.data.datasets = datasets;
        chart.options.scales.x.title.text = isPCA ? 'PRINCIPAL COMPONENT 1' : xAxisFeature.toUpperCase();
        chart.options.scales.y.title.text = isPCA ? 'PRINCIPAL COMPONENT 2' : yAxisFeature.toUpperCase();
        chart.update();
    } else {
        createChart(datasets);
    }
    
    updateAveragesTable();
    update3DChartData();
    renderClusterSongs();
}

function createChart(datasets) {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#60a5fa',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyColor: '#e2e8f0',
                    padding: 12,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => {
                            if (!items.length) return '';
                            const raw = items[0].raw.rawItem;
                            return raw.name;
                        },
                        label: (item) => {
                            const raw = item.raw.rawItem;
                            if (isPCA) {
                                return [
                                    `Artist: ${raw.artist}`,
                                    `PC1: ${item.raw.x.toFixed(3)}`,
                                    `PC2: ${item.raw.y.toFixed(3)}`
                                ];
                            } else {
                                return [
                                    `Artist: ${raw.artist}`,
                                    `${xAxisFeature}: ${item.raw.x.toFixed(3)}`,
                                    `${yAxisFeature}: ${item.raw.y.toFixed(3)}`
                                ];
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: {
                        display: true,
                        text: isPCA ? 'PRINCIPAL COMPONENT 1' : xAxisFeature.toUpperCase(),
                        color: '#f8fafc',
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: {
                        display: true,
                        text: isPCA ? 'PRINCIPAL COMPONENT 2' : yAxisFeature.toUpperCase(),
                        color: '#f8fafc',
                        font: { size: 12, weight: 'bold' }
                    }
                }
            }
        }
    });
}

function updateAveragesTable() {
    const head = document.getElementById('averages-head');
    const body = document.getElementById('averages-body');
    
    if (!head || !body) return;
    
    // Create headers
    let headHTML = '<tr><th>Cluster</th>';
    musicData.features.forEach(f => {
        headHTML += `<th>${f}</th>`;
    });
    headHTML += '</tr>';
    head.innerHTML = headHTML;
    
    // Calculate averages
    const clusterStats = Array.from({length: currentK}, () => {
        const obj = {};
        musicData.features.forEach(f => obj[f] = 0);
        return { count: 0, sums: obj };
    });
    
    for (let i = 0; i < musicData.data.length; i++) {
        const item = musicData.data[i];
        const clusterIdx = currentAssignments[i];
        if (clusterIdx !== undefined && clusterStats[clusterIdx]) {
            clusterStats[clusterIdx].count++;
            musicData.features.forEach(f => {
                clusterStats[clusterIdx].sums[f] += item.original[f];
            });
        }
    }
    
    // Create rows
    let bodyHTML = '';
    for (let c = 0; c < currentK; c++) {
        const color = CLUSTER_COLORS[c % CLUSTER_COLORS.length];
        bodyHTML += `<tr>
            <td style="font-weight: bold; color: ${color}">Cluster ${c + 1} (${clusterStats[c].count})</td>`;
        
        musicData.features.forEach(f => {
            const avg = clusterStats[c].count === 0 ? 0 : clusterStats[c].sums[f] / clusterStats[c].count;
            bodyHTML += `<td>${avg.toFixed(3)}</td>`;
        });
        bodyHTML += `</tr>`;
    }
    
    body.innerHTML = bodyHTML;
}

function update3DChartData() {
    if (!document.getElementById('plotly3d') || typeof Plotly === 'undefined') return;
    
    const data = [];
    for (let c = 0; c < currentK; c++) {
        data.push({
            x: [], y: [], z: [], text: [],
            mode: 'markers',
            type: 'scatter3d',
            name: `Cluster ${c + 1}`,
            marker: {
                size: 4,
                color: CLUSTER_COLORS[c % CLUSTER_COLORS.length].replace('0.8', '1')
            }
        });
    }
    
    for (let i = 0; i < musicData.data.length; i++) {
        const item = musicData.data[i];
        const clusterIdx = currentAssignments[i];
        if (clusterIdx !== undefined && data[clusterIdx]) {
            data[clusterIdx].x.push(isPCA ? pcaResult.projectedData[i][0] : item.original[xAxisFeature]);
            data[clusterIdx].y.push(isPCA ? pcaResult.projectedData[i][1] : item.original[yAxisFeature]);
            data[clusterIdx].z.push(isPCA ? pcaResult.projectedData[i][2] : item.original[zAxisFeature]);
            data[clusterIdx].text.push(`${item.name} - ${item.artist}`);
        }
    }
    
    const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        scene: {
            xaxis: { title: isPCA ? 'PC1' : xAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
            yaxis: { title: isPCA ? 'PC2' : yAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
            zaxis: { title: isPCA ? 'PC3' : zAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
            bgcolor: 'transparent'
        },
        font: { color: '#f8fafc', family: 'Inter' },
        legend: { font: { color: '#f8fafc' }, y: 0.5 }
    };
    
    Plotly.react('plotly3d', data, layout, {responsive: true});
}

function renderClusterSongs() {
    const container = document.getElementById('songs-list');
    if (!container) return;
    
    let html = '';
    for (let c = 0; c < currentK; c++) {
        const color = CLUSTER_COLORS[c % CLUSTER_COLORS.length];
        
        const songs = [];
        for (let i = 0; i < musicData.data.length; i++) {
            if (currentAssignments[i] === c) songs.push(musicData.data[i]);
        }
        
        const sample = songs.slice(0, 15);
        
        html += `<div class="cluster-song-group" style="border-color: ${color}">`;
        html += `<h3 style="color: ${color}">Cluster ${c + 1} (${songs.length} songs)</h3>`;
        html += `<div class="songs-grid">`;
        
        sample.forEach(s => {
            const originalIndex = musicData.data.indexOf(s);
            html += `<div class="song-card" style="border-left-color: ${color}">
                <div class="song-card-header">
                    <div class="song-icon">🎵</div>
                    <div style="min-width: 0;">
                        <div class="song-card-title">${s.name}</div>
                        <div class="song-card-artist">${s.artist}</div>
                    </div>
                </div>
                <button class="find-similar-btn glow-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; margin-top: auto; border-radius: 6px; width: 100%;" onclick="findSimilarSong(${originalIndex})">Find Similar</button>
            </div>`;
        });
        
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

function setupCustomDropdown(selectElement) {
    selectElement.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.textContent = selectElement.options[selectElement.selectedIndex].text;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-options';
    
    Array.from(selectElement.options).forEach((option) => {
        const customOption = document.createElement('div');
        customOption.className = 'custom-option';
        if (option.selected) customOption.classList.add('selected');
        customOption.textContent = option.text;
        customOption.dataset.value = option.value;
        
        customOption.addEventListener('click', function(e) {
            e.stopPropagation();
            selectElement.value = this.dataset.value;
            trigger.textContent = this.textContent;
            
            optionsContainer.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            
            wrapper.classList.remove('open');
            selectElement.dispatchEvent(new Event('change'));
        });
        
        optionsContainer.appendChild(customOption);
    });
    
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsContainer);
    
    selectElement.parentNode.insertBefore(wrapper, selectElement.nextSibling);
    
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
            if (w !== wrapper) {
                w.classList.remove('open');
                w.style.zIndex = '1';
            }
        });
        wrapper.classList.toggle('open');
        if (wrapper.classList.contains('open')) {
            wrapper.style.zIndex = '100';
        } else {
            wrapper.style.zIndex = '1';
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
            wrapper.style.zIndex = '1';
        }
    });

    selectElement.addEventListener('change', function() {
        trigger.textContent = selectElement.options[selectElement.selectedIndex].text;
        optionsContainer.querySelectorAll('.custom-option').forEach(o => {
            if (o.dataset.value === selectElement.value) {
                o.classList.add('selected');
            } else {
                o.classList.remove('selected');
            }
        });
    });
}

function findSimilarSong(targetIndex) {
    if (targetIndex < 0 || targetIndex >= musicData.data.length) return;
    
    const targetSong = musicData.data[targetIndex];
    const is3D = currentTab === '3d';
    
    const xIdx = musicData.features.indexOf(xAxisFeature);
    const yIdx = musicData.features.indexOf(yAxisFeature);
    const zIdx = is3D ? musicData.features.indexOf(zAxisFeature) : -1;
    
    let bestDist = Infinity;
    let closestIndex = -1;
    
    for (let i = 0; i < musicData.data.length; i++) {
        if (i === targetIndex) continue;
        
        const candidate = musicData.data[i];
        if (candidate.name === targetSong.name && candidate.artist === targetSong.artist) continue;
        
        let distSq = 0;
        
        distSq += Math.pow(targetSong.scaled[xIdx] - candidate.scaled[xIdx], 2);
        distSq += Math.pow(targetSong.scaled[yIdx] - candidate.scaled[yIdx], 2);
        if (is3D) {
            distSq += Math.pow(targetSong.scaled[zIdx] - candidate.scaled[zIdx], 2);
        }
        
        if (distSq < bestDist) {
            bestDist = distSq;
            closestIndex = i;
        }
    }
    
    if (closestIndex !== -1) {
        const closestSong = musicData.data[closestIndex];
        showRecommendationToast(closestSong);
    }
}

function showRecommendationToast(song) {
    const container = document.getElementById('toast-container');
    const msg = document.getElementById('toast-message');
    if (!container || !msg) return;
    
    msg.textContent = `${song.name} by ${song.artist}`;
    container.classList.remove('hidden');
    
    const closeBtn = document.getElementById('close-toast');
    if (closeBtn) {
        closeBtn.onclick = () => {
            container.classList.add('hidden');
        };
    }
}

function runEvaluation() {
    const progressContainer = document.getElementById('eval-progress');
    const chartsWrapper = document.getElementById('eval-charts');
    const statsContainer = document.getElementById('eval-stats');
    const statusText = document.getElementById('eval-status');
    const fill = document.getElementById('progress-bar-fill');
    
    progressContainer.classList.remove('hidden');
    chartsWrapper.classList.add('hidden');
    statsContainer.classList.add('hidden');
    
    const kMax = 12; // Evaluate up to K=12 for robust elbow
    const kRange = [];
    const inertias = [];
    const silhouettes = [];
    
    const dataset = musicData.data.map(d => d.scaled);
    
    let currentEvalK = 2;
    
    function evalNextStep() {
        if (currentEvalK > kMax) {
            progressContainer.classList.add('hidden');
            chartsWrapper.classList.remove('hidden');
            statsContainer.classList.remove('hidden');
            renderEvalCharts(kRange, inertias, silhouettes);
            return;
        }
        
        statusText.textContent = `Calculating metrics for K=${currentEvalK}...`;
        fill.style.width = `${((currentEvalK - 1) / (kMax - 1)) * 100}%`;
        
        // Use timeout to cede control to main thread so UI updates
        setTimeout(() => {
            // 1. Robust 9D Clustering
            const assign = kmeans(dataset, currentEvalK, 50);
            
            // 2. Map dataset to chosen 2D visualization space for evaluation metrics
            const xIdx = musicData.features.indexOf(xAxisFeature);
            const yIdx = musicData.features.indexOf(yAxisFeature);
            const datasetVIS = musicData.data.map(d => [d.scaled[xIdx], d.scaled[yIdx]]);
            
            // 3. Compute metrics based on visual projection
            const inertia = computeInertia(datasetVIS, assign, currentEvalK);
            const sil = computeSilhouette(datasetVIS, assign, currentEvalK);
            
            kRange.push(currentEvalK);
            inertias.push(inertia);
            silhouettes.push(sil);
            
            currentEvalK++;
            evalNextStep();
        }, 50);
    }
    
    evalNextStep();
}

function renderEvalCharts(kRange, inertias, silhouettes) {
    const ctxElbow = document.getElementById('elbowChart').getContext('2d');
    const ctxSil = document.getElementById('silhouetteChart').getContext('2d');
    
    if (elbowChartInstance) elbowChartInstance.destroy();
    if (silhouetteChartInstance) silhouetteChartInstance.destroy();
    
    // Find best K based on silhouette peak
    let bestSil = -Infinity;
    let bestK = 2;
    for (let i = 0; i < silhouettes.length; i++) {
        if (silhouettes[i] > bestSil) {
            bestSil = silhouettes[i];
            bestK = kRange[i];
        }
    }
    
    document.getElementById('stat-best-k').textContent = bestK;
    document.getElementById('stat-sil-score').textContent = bestSil.toFixed(3);
    
    elbowChartInstance = new Chart(ctxElbow, {
        type: 'line',
        data: {
            labels: kRange,
            datasets: [{
                label: 'Inertia (Elbow Method)',
                data: inertias,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#3b82f6',
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Inertia vs. Number of Clusters (K)', color: '#f8fafc', font: { size: 16 } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'K (Clusters)' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Inertia / SSE' } }
            }
        }
    });
    
    silhouetteChartInstance = new Chart(ctxSil, {
        type: 'line',
        data: {
            labels: kRange,
            datasets: [{
                label: 'Silhouette Score',
                data: silhouettes,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#8b5cf6',
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Silhouette Score vs. K', color: '#f8fafc', font: { size: 16 } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'K (Clusters)' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Silhouette Coeff.' } }
            }
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

let currentSearchId = 0;

function triggerPairingSearch(fixedAxis, fixedFeature) {
    const box = document.getElementById('insight-box');
    const text = document.getElementById('insight-text');
    const btn = document.getElementById('apply-insight-btn');
    const analyzeBtn = document.getElementById('analyze-insight-btn');
    
    if(!box || !musicData || !musicData.data) return;
    
    box.classList.remove('hidden');
    text.classList.remove('hidden');
    btn.classList.add('hidden');
    if (analyzeBtn) analyzeBtn.classList.add('hidden');
    
    const is3D = currentTab === '3d';
    text.innerHTML = `Analyzing optimal ${is3D ? '3D' : '2D'} combinations... <span style="display:inline-block; width:12px; height:12px; border:2px solid #3b82f6; border-top:2px solid transparent; border-radius:50%; animation:spin 1s linear infinite;"></span>`;
    
    currentSearchId++;
    const searchId = currentSearchId;
    
    const candidates = musicData.features.filter(f => f !== fixedFeature);
    const kRange = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // Reduced to 10 for performance
    
    let bestScore = -Infinity;
    let bestFeature = '';
    let bestFeatureA = '';
    let bestFeatureB = '';
    let bestK = 2;
    
    let kIdx = 0;
    const dataset9D = musicData.data.map(d => d.scaled);
    const fixedIdx = musicData.features.indexOf(fixedFeature);
    
    const pairs = [];
    if (is3D) {
        for (let i=0; i<candidates.length; i++) {
            for (let j=i+1; j<candidates.length; j++) {
                pairs.push([candidates[i], candidates[j]]);
            }
        }
    }
    
    function nextK() {
        if (searchId !== currentSearchId) return;
        
        if (kIdx >= kRange.length) {
            if (is3D) {
                text.innerHTML = `For <b>${fixedFeature}</b>, the best 3D combination is <b>${bestFeatureA} & ${bestFeatureB}</b><br>K = ${bestK} | Silhouette = ${bestScore.toFixed(3)}`;
            } else {
                text.innerHTML = `For <b>${fixedFeature}</b>, the best 2D combination is <b>${bestFeature}</b><br>K = ${bestK} | Silhouette = ${bestScore.toFixed(3)}`;
            }
            btn.classList.remove('hidden');
            if (analyzeBtn) analyzeBtn.classList.remove('hidden');
            btn.onclick = () => {
                if (is3D) {
                    if (fixedAxis === 'x') { ySelect.value = bestFeatureA; yAxisFeature = bestFeatureA; zSelect.value = bestFeatureB; zAxisFeature = bestFeatureB; }
                    else if (fixedAxis === 'y') { xSelect.value = bestFeatureA; xAxisFeature = bestFeatureA; zSelect.value = bestFeatureB; zAxisFeature = bestFeatureB; }
                    else { xSelect.value = bestFeatureA; xAxisFeature = bestFeatureA; ySelect.value = bestFeatureB; yAxisFeature = bestFeatureB; }
                } else {
                    if (fixedAxis === 'x') { ySelect.value = bestFeature; yAxisFeature = bestFeature; } 
                    else { xSelect.value = bestFeature; xAxisFeature = bestFeature; }
                }
                kSlider.value = bestK;
                currentK = bestK;
                kDisplay.textContent = currentK;
                recalculateClusters();
            };
            return;
        }
        
        const testK = kRange[kIdx];
        
        setTimeout(() => {
            if (searchId !== currentSearchId) return;
            
            const assign = kmeans(dataset9D, testK, 50);
            
            if (is3D) {
                for (let c = 0; c < pairs.length; c++) {
                    const [featA, featB] = pairs[c];
                    const idxA = musicData.features.indexOf(featA);
                    const idxB = musicData.features.indexOf(featB);
                    
                    const datasetVIS = musicData.data.map(d => [d.scaled[fixedIdx], d.scaled[idxA], d.scaled[idxB]]);
                    
                    const sil = computeSilhouette(datasetVIS, assign, testK);
                    if (sil > bestScore) {
                        bestScore = sil;
                        bestFeatureA = featA;
                        bestFeatureB = featB;
                        bestK = testK;
                    }
                }
            } else {
                for (let c = 0; c < candidates.length; c++) {
                    const candFeat = candidates[c];
                    const candIdx = musicData.features.indexOf(candFeat);
                    
                    const datasetVIS = musicData.data.map(d => {
                        return fixedAxis === 'x' 
                            ? [d.scaled[fixedIdx], d.scaled[candIdx]]
                            : [d.scaled[candIdx], d.scaled[fixedIdx]];
                    });
                    
                    const sil = computeSilhouette(datasetVIS, assign, testK);
                    if (sil > bestScore) {
                        bestScore = sil;
                        bestFeature = candFeat;
                        bestK = testK;
                    }
                }
            }
            
            kIdx++;
            nextK();
        }, 10);
    }
    
    nextK();
}

