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
let currentAssignments = [];
let elbowChartInstance;
let silhouetteChartInstance;

const loader = document.getElementById('loader');
const kDisplay = document.getElementById('k-display');
const kSlider = document.getElementById('k-slider');
const xSelect = document.getElementById('x-axis');
const ySelect = document.getElementById('y-axis');
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
        if (f === xAxisFeature) optX.selected = true;
        if (f === yAxisFeature) optY.selected = true;
        xSelect.add(optX);
        ySelect.add(optY);
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
    
    const evaluateBtn = document.getElementById('evaluate-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const evalModal = document.getElementById('eval-modal');
    
    if (evaluateBtn) {
        evaluateBtn.addEventListener('click', () => {
            evalModal.classList.remove('hidden');
            runEvaluation();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            evalModal.classList.add('hidden');
        });
    }
    
    loader.style.opacity = '0';
    
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
