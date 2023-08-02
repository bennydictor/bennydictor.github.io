function deferred(body) {
    const funcs = [];
    const defer = (f) => {
        funcs.push(f);
    }
    try {
        body(defer);
    } finally {
        for (const f of funcs.reverse()) {
            f()
        }
    }
}

function toCV({rows, cols, data32F}) {
    const mat = new cv.Mat(rows, cols, cv.CV_32FC3);
    mat.data32F.set(data32F);
    return mat;
}

function fromCV(mat) {
    return {
        rows: mat.rows,
        cols: mat.cols,
        data32F: mat.data32F,
    }
}
