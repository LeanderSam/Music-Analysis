// Palette for up to 15 clusters
const CLUSTER_COLORS = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(236, 72, 153, 0.8)',   // pink
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(245, 158, 11, 0.8)',   // yellow
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(6, 182, 212, 0.8)',    // cyan
    'rgba(249, 115, 22, 0.8)',   // orange
    'rgba(217, 70, 239, 0.8)',   // fuchsia
    'rgba(132, 204, 22, 0.8)',   // lime
    'rgba(20, 184, 166, 0.8)',   // teal
    'rgba(99, 102, 241, 0.8)',   // indigo
    'rgba(168, 85, 247, 0.8)',   // violet
    'rgba(244, 63, 94, 0.8)',    // rose
    'rgba(252, 211, 77, 0.8)'    // glowing yellow
];

let chart;
let currentK = 5;
let xAxisFeature = 'energy';
let yAxisFeature = 'danceability';
let zAxisFeature = 'loudness';
let currentTab = 'home';
let currentAssignments = [];
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
            views.forEach(v => v.classList.add('hidden'));
            
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            const targetView = document.getElementById(`view-${currentTab}`);
            if(targetView) targetView.classList.remove('hidden');
            
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

    // Initial Calculation
    recalculateClusters();
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
        
        // Use raw original values for display
        datasets[clusterIdx].data.push({
            x: item.original[xAxisFeature],
            y: item.original[yAxisFeature],
            rawItem: item
        });
    }
    
    if (chart) {
        chart.data.datasets = datasets;
        chart.options.scales.x.title.text = xAxisFeature.toUpperCase();
        chart.options.scales.y.title.text = yAxisFeature.toUpperCase();
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
                            return [
                                `Artist: ${raw.artist}`,
                                `${xAxisFeature}: ${item.raw.x.toFixed(3)}`,
                                `${yAxisFeature}: ${item.raw.y.toFixed(3)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: {
                        display: true,
                        text: xAxisFeature.toUpperCase(),
                        color: '#f8fafc',
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: {
                        display: true,
                        text: yAxisFeature.toUpperCase(),
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
            data[clusterIdx].x.push(item.original[xAxisFeature]);
            data[clusterIdx].y.push(item.original[yAxisFeature]);
            data[clusterIdx].z.push(item.original[zAxisFeature]);
            data[clusterIdx].text.push(`${item.name} - ${item.artist}`);
        }
    }
    
    const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        scene: {
            xaxis: { title: xAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
            yaxis: { title: yAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
            zaxis: { title: zAxisFeature.toUpperCase(), backgroundcolor: 'transparent', gridcolor: 'rgba(255,255,255,0.1)' },
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
                <div class="song-card-title">${s.name}</div>
                <div class="song-card-artist">${s.artist}</div>
                <button class="find-similar-btn glow-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; margin-top: 0.5rem; border-radius: 6px; width: 100%;" onclick="findSimilarSong(${originalIndex})">Find Similar</button>
            </div>`;
        });
        
        html += `</div></div>`;
    }
    container.innerHTML = html;
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

