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

/**
 * Computes the Inertia (Sum of Squared Errors) for a given clustering.
 */
function computeInertia(data, assignments, k) {
    let centroids = Array.from({ length: k }, () => new Array(data[0].length).fill(0));
    let counts = new Array(k).fill(0);
    
    for (let i = 0; i < data.length; i++) {
        let c = assignments[i];
        counts[c]++;
        for (let j = 0; j < data[i].length; j++) {
            centroids[c][j] += data[i][j];
        }
    }
    
    for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
            for (let j = 0; j < centroids[c].length; j++) {
                centroids[c][j] /= counts[c];
            }
        }
    }
    
    let inertia = 0;
    for (let i = 0; i < data.length; i++) {
        let c = assignments[i];
        let p = data[i];
        let cent = centroids[c];
        let sum = 0;
        for (let d = 0; d < p.length; d++) {
            sum += (p[d] - cent[d]) ** 2;
        }
        // Squared distance
        inertia += sum;
    }
    return inertia;
}

/**
 * Computes the mean Silhouette Coefficient of all samples.
 * O(N^2) implementation.
 */
function computeSilhouette(data, assignments, k) {
    if (k <= 1 || k >= data.length) return 0;
    
    let clusters = Array.from({ length: k }, () => []);
    for (let i = 0; i < data.length; i++) {
        clusters[assignments[i]].push(i);
    }
    
    let totalSilhouette = 0;
    
    for (let i = 0; i < data.length; i++) {
        let a_i = 0;
        let myCluster = assignments[i];
        let myClusterPts = clusters[myCluster];
        let ptI = data[i];
        
        if (myClusterPts.length === 1) {
            continue;
        }
        
        // Calculate a(i)
        for (let j = 0; j < myClusterPts.length; j++) {
            let pIdx = myClusterPts[j];
            if (pIdx !== i) {
                let ptJ = data[pIdx];
                let sum = 0;
                for (let d = 0; d < ptI.length; d++) {
                    sum += (ptI[d] - ptJ[d]) ** 2;
                }
                a_i += Math.sqrt(sum);
            }
        }
        a_i /= (myClusterPts.length - 1);
        
        // Calculate b(i)
        let b_i = Infinity;
        for (let c = 0; c < k; c++) {
            if (c === myCluster) continue;
            let otherClusterPts = clusters[c];
            if (otherClusterPts.length === 0) continue;
            
            let distToOther = 0;
            for (let j = 0; j < otherClusterPts.length; j++) {
                let ptJ = data[otherClusterPts[j]];
                let sum = 0;
                for (let d = 0; d < ptI.length; d++) {
                    sum += (ptI[d] - ptJ[d]) ** 2;
                }
                distToOther += Math.sqrt(sum);
            }
            distToOther /= otherClusterPts.length;
            
            if (distToOther < b_i) {
                b_i = distToOther;
            }
        }
        
        let s_i = (b_i - a_i) / Math.max(a_i, b_i);
        if (isNaN(s_i)) s_i = 0;
        totalSilhouette += s_i;
    }
    
    return totalSilhouette / data.length;
}
