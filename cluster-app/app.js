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
let customAlbumSongs = [];
let albumTitle = "Symphony No. 8";
let albumSuggestion = null;

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
            
            if (currentTab === 'about' || currentTab === 'home' || currentTab === 'album') {
                if(sidebarControls) sidebarControls.style.display = 'none';
                if(sharedSongs) sharedSongs.classList.add('hidden');
                if (currentTab === 'album') {
                    // Update layout size on view change
                    setTimeout(renderAlbumSlots, 50);
                }
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

    // Custom Album Listeners
    const albumTitleInput = document.getElementById('album-title-input');
    if (albumTitleInput) {
        albumTitleInput.value = albumTitle;
        albumTitleInput.addEventListener('input', (e) => {
            albumTitle = e.target.value || "Untitled Album";
            drawProceduralCover();
        });
    }

    const albumSearchInput = document.getElementById('album-search-input');
    if (albumSearchInput) {
        albumSearchInput.value = '';
        albumSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            executeAlbumSearch(query);
        });
    }

    const regenBtn = document.getElementById('regenerate-art-btn');
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            drawProceduralCover(true);
        });
    }

    // Initial render of empty slots
    renderAlbumSlots();
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
                <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:auto; width:100%;">
                    <button class="find-similar-btn glow-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%;" onclick="findSimilarSong(${originalIndex})">Find Similar</button>
                    <button class="add-to-album-btn glow-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);" onclick="addToCustomAlbum(${originalIndex})">Add to Album</button>
                </div>
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

/* ==========================================================================
   Custom Album Creator Helpers
   ========================================================================== */

function showToastMessage(text, icon = "🎵") {
    const container = document.getElementById('toast-container');
    const msg = document.getElementById('toast-message');
    const iconEl = container ? container.querySelector('.toast-icon') : null;
    const titleEl = container ? container.querySelector('.toast-text strong') : null;
    if (!container || !msg) return;
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) {
        if (icon === "💿") titleEl.textContent = "Custom Album";
        else if (icon === "⚠️") titleEl.textContent = "Warning";
        else if (icon === "🗑️") titleEl.textContent = "Custom Album";
        else titleEl.textContent = "Closest Song";
    }
    msg.textContent = text;
    container.classList.remove('hidden');
    
    // Auto-close after 3 seconds
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        container.classList.add('hidden');
    }, 3000);
}

// Override original recommendation toast to use general function
function showRecommendationToast(song) {
    showToastMessage(`${song.name} by ${song.artist}`, "🎵");
}

function calculateAlbumSuggestion() {
    const len = customAlbumSongs.length;
    if (len < 5 || len >= 8) {
        albumSuggestion = null;
        return;
    }
    
    // Calculate average vector in 9D space of all currently selected tracks
    let avgVector = new Array(9).fill(0);
    customAlbumSongs.forEach(song => {
        for (let j = 0; j < 9; j++) {
            avgVector[j] += song.scaled[j];
        }
    });
    for (let j = 0; j < 9; j++) {
        avgVector[j] /= len;
    }
    
    // Find closest song
    let closestSong = null;
    let minDistance = Infinity;
    
    for (let i = 0; i < musicData.data.length; i++) {
        const candidate = musicData.data[i];
        
        // Skip if already in the album
        if (customAlbumSongs.some(s => s.id === candidate.id)) continue;
        
        // Compute Euclidean distance
        let distSq = 0;
        for (let j = 0; j < 9; j++) {
            distSq += Math.pow(avgVector[j] - candidate.scaled[j], 2);
        }
        
        if (distSq < minDistance) {
            minDistance = distSq;
            closestSong = candidate;
        }
    }
    
    albumSuggestion = closestSong;
}

function acceptAlbumSuggestion() {
    if (!albumSuggestion) return;
    const song = albumSuggestion;
    albumSuggestion = null;
    customAlbumSongs.push(song);
    renderAlbumSlots();
    
    // Refresh search results to show disabled "Added" status
    const searchInput = document.getElementById('album-search-input');
    if (searchInput) {
        executeAlbumSearch(searchInput.value.trim().toLowerCase());
    }
    
    showToastMessage(`Accepted suggestion: "${song.name}"!`, "💿");
}

function renderAlbumSlots() {
    const container = document.getElementById('album-slots');
    if (!container) return;
    
    const len = customAlbumSongs.length;
    // Calculate suggestion if 5, 6, or 7 songs are added
    if (len >= 5 && len < 8) {
        calculateAlbumSuggestion();
    } else {
        albumSuggestion = null;
    }
    
    let html = '';
    for (let i = 0; i < 8; i++) {
        const song = customAlbumSongs[i];
        if (song) {
            html += `
            <div class="album-slot filled">
                <div class="slot-track-icon">💿</div>
                <div class="slot-track-details">
                    <div class="slot-track-title" title="${song.name}">${song.name}</div>
                    <div class="slot-track-artist" title="${song.artist}">${song.artist}</div>
                </div>
                <button class="slot-remove-btn" onclick="removeFromCustomAlbum(${i})">&times;</button>
            </div>`;
        } else if (i === len && albumSuggestion) {
            html += `
            <div class="album-slot suggested">
                <div class="slot-suggest-icon">✨</div>
                <div class="slot-track-details">
                    <div class="slot-track-title" style="color: #c084fc; font-weight: 700;" title="${albumSuggestion.name}">${albumSuggestion.name}</div>
                    <div class="slot-track-artist" title="${albumSuggestion.artist}">${albumSuggestion.artist}</div>
                    <div style="font-size: 0.7rem; color: #a78bfa; font-weight: 600; text-transform: uppercase; margin-top: 0.15rem;">✨ Suggested Track</div>
                </div>
                <button class="slot-accept-btn" onclick="acceptAlbumSuggestion()">Accept</button>
            </div>`;
        } else {
            html += `
            <div class="album-slot empty" id="slot-${i}">
                <div class="slot-number">${i + 1}</div>
                <div class="slot-placeholder">Empty Slot</div>
            </div>`;
        }
    }
    container.innerHTML = html;
    
    // Update badge count
    const countBadge = document.getElementById('album-track-count');
    if (countBadge) {
        countBadge.textContent = `${len} / 8 Tracks`;
    }
    
    // Show/hide evaluation
    const evalContainer = document.getElementById('album-evaluation');
    if (evalContainer) {
        if (len > 0) {
            evalContainer.classList.remove('hidden');
            updateAlbumEvaluation();
        } else {
            evalContainer.classList.add('hidden');
        }
    }
}

function addToCustomAlbum(songIndex) {
    if (songIndex < 0 || songIndex >= musicData.data.length) return;
    const song = musicData.data[songIndex];
    
    // Check if already in album
    if (customAlbumSongs.some(s => s.id === song.id)) {
        showToastMessage(`"${song.name}" is already in your album!`, "⚠️");
        return;
    }
    
    if (customAlbumSongs.length >= 8) {
        showToastMessage("Your album is full! Remove a song first.", "⚠️");
        return;
    }
    
    customAlbumSongs.push(song);
    
    // Reset suggestion state if we are out of recommendation bounds
    if (customAlbumSongs.length < 5 || customAlbumSongs.length >= 8) {
        albumSuggestion = null;
    }
    
    renderAlbumSlots();
    
    // Refresh search results to show disabled "Added" status
    const searchInput = document.getElementById('album-search-input');
    if (searchInput) {
        executeAlbumSearch(searchInput.value.trim().toLowerCase());
    }
    
    showToastMessage(`Added "${song.name}" to your album!`, "💿");
}

function removeFromCustomAlbum(index) {
    if (index < 0 || index >= customAlbumSongs.length) return;
    const removed = customAlbumSongs.splice(index, 1)[0];
    
    // Reset suggestion state on removal
    albumSuggestion = null;
    
    renderAlbumSlots();
    
    // Refresh search results to show enable "Add" status
    const searchInput = document.getElementById('album-search-input');
    if (searchInput) {
        executeAlbumSearch(searchInput.value.trim().toLowerCase());
    }
    
    showToastMessage(`Removed "${removed.name}"`, "🗑️");
}

function executeAlbumSearch(query) {
    const container = document.getElementById('album-search-results');
    if (!container) return;
    
    if (!query) {
        container.innerHTML = '<p class="search-placeholder">Start typing to search songs from our dataset...</p>';
        return;
    }
    
    // Normalization helper
    const cleanText = (str) => {
        if (!str) return '';
        return str.toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[’'’`´]/g, "'"); // replace various curly/straight apostrophes
    };
    
    const cleanQuery = cleanText(query);
    
    // Filter matches and deduplicate
    const matches = [];
    const seen = new Set();
    
    for (let i = 0; i < musicData.data.length; i++) {
        const song = musicData.data[i];
        const cleanName = cleanText(song.name);
        const cleanArtist = cleanText(song.artist);
        
        if (cleanName.includes(cleanQuery) || cleanArtist.includes(cleanQuery)) {
            const uniqKey = `${cleanName.trim()}|||${cleanArtist.trim()}`;
            if (!seen.has(uniqKey)) {
                seen.add(uniqKey);
                matches.push({ song, originalIndex: i });
                if (matches.length >= 100) break; // cap at 100 for performance
            }
        }
    }
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="search-placeholder">No songs found matching your search.</p>';
        return;
    }
    
    let html = '';
    matches.forEach(m => {
        const s = m.song;
        const isAdded = customAlbumSongs.some(item => item.id === s.id);
        const buttonHTML = isAdded 
            ? `<button class="result-add-btn glow-btn" style="background: rgba(255,255,255,0.08); box-shadow: none; pointer-events: none; border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted);">Added</button>`
            : `<button class="result-add-btn glow-btn" onclick="addToCustomAlbum(${m.originalIndex})">Add</button>`;
        
        html += `
        <div class="search-result-item">
            <div class="result-track-details">
                <div class="result-track-title" title="${s.name}">${s.name}</div>
                <div class="result-track-artist" title="${s.artist}">${s.artist}</div>
                <div class="result-track-pop">🔥 Popularity: ${s.popularity}%</div>
            </div>
            ${buttonHTML}
        </div>`;
    });
    container.innerHTML = html;
}

function updateAlbumEvaluation() {
    if (customAlbumSongs.length === 0) return;
    
    let totalPop = 0;
    let avgFeatures = { energy: 0, danceability: 0, valence: 0, acousticness: 0, tempo: 0 };
    
    customAlbumSongs.forEach(s => {
        totalPop += s.popularity;
        avgFeatures.energy += s.original.energy;
        avgFeatures.danceability += s.original.danceability;
        avgFeatures.valence += s.original.valence;
        avgFeatures.acousticness += s.original.acousticness;
        avgFeatures.tempo += s.original.tempo;
    });
    
    const count = customAlbumSongs.length;
    const avgPop = totalPop / count;
    avgFeatures.energy /= count;
    avgFeatures.danceability /= count;
    avgFeatures.valence /= count;
    avgFeatures.acousticness /= count;
    avgFeatures.tempo /= count;
    
    // 1. Popularity display
    const popVal = document.getElementById('album-popularity-val');
    const popDesc = document.getElementById('album-popularity-desc');
    if (popVal && popDesc) {
        popVal.textContent = `${Math.round(avgPop)}%`;
        if (avgPop >= 80) popDesc.textContent = "💥 Mainstream Blockbusters";
        else if (avgPop >= 55) popDesc.textContent = "🎧 Popular Radio Mix";
        else if (avgPop >= 30) popDesc.textContent = "🌟 Alternative / Indie Gems";
        else popDesc.textContent = "🌲 Deep Underground Cuts";
    }
    
    // 2. Cohesiveness Score
    // Compute standard deviation of scaled features
    let featureVariances = [];
    const features = ['energy', 'danceability', 'valence', 'acousticness', 'tempo'];
    
    features.forEach(feat => {
        const featIdx = musicData.features.indexOf(feat);
        // Calculate mean of scaled feature
        let sumScaled = 0;
        customAlbumSongs.forEach(s => {
            sumScaled += s.scaled[featIdx];
        });
        const meanScaled = sumScaled / count;
        
        // Calculate variance
        let variance = 0;
        customAlbumSongs.forEach(s => {
            variance += Math.pow(s.scaled[featIdx] - meanScaled, 2);
        });
        variance /= count;
        featureVariances.push(variance);
    });
    
    // Average variance across our features
    const avgVar = featureVariances.reduce((a, b) => a + b, 0) / featureVariances.length;
    const aggStd = Math.sqrt(avgVar);
    
    // Map to a 0-100 Cohesiveness Score
    // Scale is typically 0.2 to 1.8. Let's make 0.3 extremely cohesive (100) and 1.5 chaotic (0).
    let cohesionScore = Math.max(0, Math.min(100, Math.round(100 * (1.3 - aggStd) / 1.0)));
    // If only 1 song, it's perfectly cohesive
    if (count === 1) cohesionScore = 100;
    
    const cohesionVal = document.getElementById('album-cohesion-val');
    const cohesionDesc = document.getElementById('album-cohesion-desc');
    if (cohesionVal && cohesionDesc) {
        cohesionVal.textContent = `${cohesionScore}%`;
        if (cohesionScore >= 80) cohesionDesc.textContent = "💿 Concept Album (High Cohesion)";
        else if (cohesionScore >= 55) cohesionDesc.textContent = "🎼 Balanced Curated Flow";
        else if (cohesionScore >= 30) cohesionDesc.textContent = "📻 Diverse Mixtape";
        else cohesionDesc.textContent = "🌀 Chaos Shuffle (Eclectic)";
    }
    
    // 3. Vibe Matching
    const vibeTitle = document.getElementById('album-vibe-title');
    const vibeDesc = document.getElementById('album-vibe-desc');
    
    if (vibeTitle && vibeDesc) {
        if (avgFeatures.energy > 0.68 && avgFeatures.danceability > 0.68) {
            vibeTitle.textContent = "🎉 Club Party Energy";
            vibeDesc.textContent = "Packed with highly danceable, rhythmic, and high-energy tracks. This album is engineered to get people moving.";
        } else if (avgFeatures.energy > 0.58 && avgFeatures.valence > 0.58) {
            vibeTitle.textContent = "☀️ Warm & Uplifting Sunshine";
            vibeDesc.textContent = "Vibrant, happy tracks with high emotional positivity. Perfect for road trips, sunny days, or boosting your mood.";
        } else if (avgFeatures.acousticness > 0.6 && avgFeatures.energy < 0.4) {
            vibeTitle.textContent = "🌿 Acoustic Calm & Haven";
            vibeDesc.textContent = "Soft, unplugged acoustic tones dominate. Ideal for cozy evenings, coffee shops, reading, or calming study sessions.";
        } else if (avgFeatures.energy > 0.65 && avgFeatures.valence < 0.4) {
            vibeTitle.textContent = "🔥 Intense & Gritty Beats";
            vibeDesc.textContent = "Heavy, loud, and dark-tinged tracks. Creates a powerful, intense, and driving atmosphere for focus or workouts.";
        } else if (avgFeatures.valence < 0.4 && avgFeatures.energy < 0.45) {
            vibeTitle.textContent = "🌧️ Melancholic Late-Night Reflection";
            vibeDesc.textContent = "Somber, slower, and emotionally reflective melodies. Best suited for quiet introspection or late-night drives.";
        } else if (avgFeatures.acousticness < 0.2 && avgFeatures.energy < 0.4 && avgFeatures.danceability > 0.5) {
            vibeTitle.textContent = "🌌 Late Night Electronic Chill";
            vibeDesc.textContent = "Synthesized, low-energy chill beats that feel modern and atmospheric. Perfect background flow for creative work.";
        } else {
            vibeTitle.textContent = "🎨 Eclectic Dynamic Soundscape";
            vibeDesc.textContent = "A diverse, multi-genre fusion. Traverses a wide spectrum of tempos, volume levels, and acoustic properties.";
        }
    }
    
    // 4. Update progress bars
    const featuresToUpdate = ['energy', 'danceability', 'valence', 'acousticness'];
    featuresToUpdate.forEach(f => {
        const percentVal = Math.round(avgFeatures[f] * 100);
        const barFill = document.getElementById(`bar-fill-${f}`);
        const barVal = document.getElementById(`bar-val-${f}`);
        if (barFill) barFill.style.width = `${percentVal}%`;
        if (barVal) barVal.textContent = `${percentVal}%`;
    });
    
    const tempoFill = document.getElementById('bar-fill-tempo');
    const tempoVal = document.getElementById('bar-val-tempo');
    if (tempoFill) {
        // Normal tempo range 50 - 200 BPM
        const tempoPercent = Math.max(0, Math.min(100, Math.round(((avgFeatures.tempo - 50) / 150) * 100)));
        tempoFill.style.width = `${tempoPercent}%`;
    }
    if (tempoVal) {
        tempoVal.textContent = `${Math.round(avgFeatures.tempo)} BPM`;
    }
    
    // 5. Draw the album cover
    drawProceduralCover();
}

let coverSeed = 42;
function drawProceduralCover(forceRegenerate = false) {
    const canvas = document.getElementById('album-cover-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (forceRegenerate) {
        coverSeed = Math.floor(Math.random() * 1000);
    }
    
    const w = canvas.width;
    const h = canvas.height;
    
    // Calculate averages for visual properties
    let avgValence = 0.5;
    let avgEnergy = 0.5;
    let avgDance = 0.5;
    let avgTempo = 120;
    let avgAcoustic = 0.5;
    
    if (customAlbumSongs.length > 0) {
        let sumValence = 0, sumEnergy = 0, sumDance = 0, sumTempo = 0, sumAcoustic = 0;
        customAlbumSongs.forEach(s => {
            sumValence += s.original.valence;
            sumEnergy += s.original.energy;
            sumDance += s.original.danceability;
            sumTempo += s.original.tempo;
            sumAcoustic += s.original.acousticness;
        });
        avgValence = sumValence / customAlbumSongs.length;
        avgEnergy = sumEnergy / customAlbumSongs.length;
        avgDance = sumDance / customAlbumSongs.length;
        avgTempo = sumTempo / customAlbumSongs.length;
        avgAcoustic = sumAcoustic / customAlbumSongs.length;
    }
    
    // Determine color palette based on Valence and Energy
    let color1, color2, color3;
    if (avgValence > 0.6) {
        // Bright / Warm / Happy
        color1 = `hsl(${Math.round(30 + avgValence * 50)}, 85%, 55%)`; // Warm gold / orange
        color2 = `hsl(${Math.round(310 + avgEnergy * 40)}, 80%, 50%)`; // Radiant magenta/pink
        color3 = `hsl(${Math.round(180 + avgDance * 50)}, 90%, 45%)`; // Aqua / Cyan
    } else if (avgValence < 0.4 && avgEnergy < 0.45) {
        // Melancholic / Moody / Deep
        color1 = `hsl(${Math.round(210 + avgValence * 20)}, 50%, 25%)`; // Deep slate blue
        color2 = `hsl(${Math.round(270 + avgEnergy * 30)}, 40%, 20%)`; // Dim purple
        color3 = `hsl(${Math.round(340 + avgValence * 40)}, 45%, 30%)`; // Crimson / Plum
    } else if (avgEnergy > 0.7) {
        // Cyberpunk / High Contrast
        color1 = `hsl(320, 95%, 50%)`; // Electric pink
        color2 = `hsl(190, 95%, 45%)`; // Electric cyan
        color3 = `hsl(260, 90%, 40%)`; // Deep violet
    } else if (avgAcoustic > 0.6) {
        // Earthy / Soft Pastels
        color1 = `hsl(40, 45%, 40%)`; // Soft copper
        color2 = `hsl(140, 30%, 35%)`; // Muted sage green
        color3 = `hsl(20, 40%, 45%)`; // Clay terracotta
    } else {
        // Balanced / Symphony default
        color1 = `#3b82f6`; // Indigo blue
        color2 = `#8b5cf6`; // Royal purple
        color3 = `#ec4899`; // Hot pink
    }
    
    // Draw Background Gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.5, color2);
    grad.addColorStop(1, color3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    // Draw Abstract shapes using coverSeed
    ctx.save();
    // Combine song IDs for a deterministic layout seed
    let combinedIdSum = customAlbumSongs.reduce((sum, s) => sum + s.id, 0) + coverSeed;
    
    // Pseudo random generator based on seed
    function pseudoRand(s) {
        let x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    }
    
    let rSeed = combinedIdSum;
    
    // Number of shapes depends on tempo and danceability
    const shapeCount = Math.round(10 + avgTempo / 10);
    
    for (let i = 0; i < shapeCount; i++) {
        rSeed += 0.5;
        const rx = pseudoRand(rSeed) * w;
        rSeed += 0.5;
        const ry = pseudoRand(rSeed) * h;
        rSeed += 0.5;
        const radius = pseudoRand(rSeed) * (40 + avgDance * 80) + 10;
        
        rSeed += 0.5;
        const shapeType = pseudoRand(rSeed);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        if (shapeType < 0.4) {
            // Circle
            ctx.arc(rx, ry, radius, 0, Math.PI * 2);
            if (pseudoRand(rSeed + 1) > 0.5) ctx.fill();
            else ctx.stroke();
        } else if (shapeType < 0.75) {
            // Polygon / Diamond
            const sides = 3 + Math.floor(pseudoRand(rSeed + 2) * 5); // 3 to 7 sides
            for (let s = 0; s < sides; s++) {
                const angle = (s / sides) * Math.PI * 2 + pseudoRand(rSeed + 3) * Math.PI;
                const px = rx + Math.cos(angle) * radius;
                const py = ry + Math.sin(angle) * radius;
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            if (pseudoRand(rSeed + 4) > 0.5) ctx.fill();
            else ctx.stroke();
        } else {
            // Waves/Curves
            ctx.moveTo(rx - radius, ry);
            ctx.quadraticCurveTo(rx, ry - radius * 1.5, rx + radius, ry);
            ctx.stroke();
        }
    }
    ctx.restore();
    
    // Draw Frosted glass card in center for the album label
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    
    const cardW = w * 0.85;
    const cardH = h * 0.32;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;
    const radius = 12;
    
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Album Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 1.25rem "Outfit", sans-serif';
    // Truncate title if too long
    let displayTitle = albumTitle || "Symphony No. 8";
    if (displayTitle.length > 22) {
        displayTitle = displayTitle.substring(0, 20) + "...";
    }
    ctx.fillText(displayTitle.toUpperCase(), w / 2, h / 2 - 12);
    
    // Subtitle (Curators credit or track list summary)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 0.65rem "Inter", sans-serif';
    ctx.fillText(`CURATED CONCEPT ALBUM • ${customAlbumSongs.length} TRACKS`, w / 2, h / 2 + 15);
}

