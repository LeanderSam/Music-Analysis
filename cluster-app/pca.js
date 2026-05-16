// Lightweight Principal Component Analysis implementation using Power Iteration

function computePCA(dataMatrix, numComponents = 3) {
    if (!dataMatrix || dataMatrix.length === 0) return [];
    
    const numRows = dataMatrix.length;
    const numCols = dataMatrix[0].length;
    
    // 1. Center the data (subtract mean of each column)
    const means = new Array(numCols).fill(0);
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            means[j] += dataMatrix[i][j];
        }
    }
    for (let j = 0; j < numCols; j++) {
        means[j] /= numRows;
    }
    
    const centeredData = [];
    for (let i = 0; i < numRows; i++) {
        const row = [];
        for (let j = 0; j < numCols; j++) {
            row.push(dataMatrix[i][j] - means[j]);
        }
        centeredData.push(row);
    }
    
    // 2. Compute Covariance Matrix
    const covMatrix = [];
    for (let i = 0; i < numCols; i++) {
        covMatrix[i] = new Array(numCols).fill(0);
        for (let j = 0; j < numCols; j++) {
            let sum = 0;
            for (let k = 0; k < numRows; k++) {
                sum += centeredData[k][i] * centeredData[k][j];
            }
            covMatrix[i][j] = sum / (numRows - 1);
        }
    }
    
    // 3. Power Iteration to find top eigenvectors
    const eigenvectors = [];
    const eigenvalues = [];
    let currentCov = JSON.parse(JSON.stringify(covMatrix));
    
    let totalVariance = 0;
    for (let i = 0; i < numCols; i++) {
        totalVariance += covMatrix[i][i];
    }
    
    for (let k = 0; k < numComponents; k++) {
        // Initialize random vector
        let vec = new Array(numCols);
        let sqSumInit = 0;
        for (let i = 0; i < numCols; i++) {
            vec[i] = Math.random() - 0.5;
            sqSumInit += vec[i] * vec[i];
        }
        let norm = Math.sqrt(sqSumInit);
        for (let i = 0; i < numCols; i++) vec[i] /= norm;
        
        let prevVec = new Array(numCols).fill(0);
        
        // Iterate
        for (let iter = 0; iter < 1000; iter++) {
            const nextVec = new Array(numCols).fill(0);
            for (let i = 0; i < numCols; i++) {
                for (let j = 0; j < numCols; j++) {
                    nextVec[i] += currentCov[i][j] * vec[j];
                }
            }
            
            // Normalize
            let sqSum = 0;
            for (let i = 0; i < numCols; i++) sqSum += nextVec[i] * nextVec[i];
            const nextNorm = Math.sqrt(sqSum);
            if (nextNorm === 0) break;
            for (let i = 0; i < numCols; i++) nextVec[i] /= nextNorm;
            
            // Check convergence
            let diff = 0;
            for (let i = 0; i < numCols; i++) diff += Math.abs(nextVec[i] - vec[i]);
            
            vec = nextVec;
            if (diff < 1e-6) break;
        }
        
        eigenvectors.push(vec);
        
        // Deflate covariance matrix
        // C_new = C - lambda * v * v^T
        // Find eigenvalue (Rayleigh quotient)
        let lambda = 0;
        const temp = new Array(numCols).fill(0);
        for (let i = 0; i < numCols; i++) {
            for (let j = 0; j < numCols; j++) {
                temp[i] += currentCov[i][j] * vec[j];
            }
        }
        for (let i = 0; i < numCols; i++) lambda += vec[i] * temp[i];
        
        eigenvalues.push(lambda);
        
        for (let i = 0; i < numCols; i++) {
            for (let j = 0; j < numCols; j++) {
                currentCov[i][j] -= lambda * vec[i] * vec[j];
            }
        }
    }
    
    // 4. Project Data onto Principal Components
    const projectedData = [];
    for (let i = 0; i < numRows; i++) {
        const projRow = [];
        for (let k = 0; k < numComponents; k++) {
            let sum = 0;
            for (let j = 0; j < numCols; j++) {
                sum += centeredData[i][j] * eigenvectors[k][j];
            }
            projRow.push(sum);
        }
        projectedData.push(projRow);
    }
    
    return {
        projectedData,
        eigenvalues,
        eigenvectors,
        totalVariance
    };
}
