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

// Start
document.addEventListener('DOMContentLoaded', init);
