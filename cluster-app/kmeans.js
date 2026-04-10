/**
 * Computes Euclidean distance between two vectors.
 */
function euclideanDist(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
}

/**
 * Basic K-Means implementation in Vanilla JS
 * @param {Array<Array<number>>} data - The array of vectors to cluster
 * @param {number} k - The number of clusters
 * @param {number} maxIters - Maximum iterations
 * @returns {Array<number>} An array of cluster assignments matching the input order
 */
function kmeans(data, k, maxIters = 50) {
    if (!data || !data.length) return [];
    
    // 1. Initialize k centroids randomly from the data points
    // (using kmeans++ logic trivially or just random selection)
    let centroids = [];
    let initialIndices = new Set();
    while (centroids.length < k) {
        let idx = Math.floor(Math.random() * data.length);
        if (!initialIndices.has(idx)) {
            initialIndices.add(idx);
            centroids.push([...data[idx]]);
        }
    }
    
    let assignments = new Array(data.length).fill(-1);
    let changed = true;
    let iters = 0;
    
    while (changed && iters < maxIters) {
        changed = false;
        iters++;
        
        // Assign clusters
        for (let i = 0; i < data.length; i++) {
            let point = data[i];
            let minDist = Infinity;
            let closestCentroid = -1;
            
            for (let c = 0; c < k; c++) {
                let d = euclideanDist(point, centroids[c]);
                if (d < minDist) {
                    minDist = d;
                    closestCentroid = c;
                }
            }
            
            if (assignments[i] !== closestCentroid) {
                assignments[i] = closestCentroid;
                changed = true;
            }
        }
        
        // Recompute centroids
        let newCentroids = Array.from({ length: k }, () => new Array(data[0].length).fill(0));
        let counts = new Array(k).fill(0);
        
        for (let i = 0; i < data.length; i++) {
            let c = assignments[i];
            counts[c]++;
            for (let j = 0; j < data[i].length; j++) {
                newCentroids[c][j] += data[i][j];
            }
        }
        
        for (let c = 0; c < k; c++) {
            if (counts[c] > 0) {
                for (let j = 0; j < newCentroids[c].length; j++) {
                    newCentroids[c][j] /= counts[c];
                }
                centroids[c] = newCentroids[c];
            } else {
                // If a centroid loses all points, re-initialize it to a random point
                centroids[c] = [...data[Math.floor(Math.random() * data.length)]];
            }
        }
    }
    
    return assignments;
}
