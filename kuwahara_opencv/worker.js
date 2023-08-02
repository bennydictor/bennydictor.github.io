importScripts(
    "https://docs.opencv.org/3.4.0/opencv.js",
    "common.js",
);

onmessage = (e) => {
    const {inputImage, blurRadius, kernelRadius, sharpness} = e.data;
    deferred((defer) => {
        const original = toCV(inputImage);
        defer(() => original.delete());

        const sobelXChan = new cv.MatVector();
        defer(() => sobelXChan.delete());

        const sobelYChan = new cv.MatVector();
        defer(() => sobelYChan.delete());

        deferred((defer) => {
            const tmp = new cv.Mat();
            defer(() => tmp.delete());

            cv.Sobel(original, tmp, cv.CV_32F, 1, 0, 3);
            cv.split(tmp, sobelXChan);

            cv.Sobel(original, tmp, cv.CV_32F, 0, 1, 3);
            cv.split(tmp, sobelYChan);
        });

        const j11 = new cv.Mat();
        defer(() => j11.delete());

        deferred((defer) => {
            const tmp = new cv.Mat();
            defer(() => tmp.delete());

            cv.multiply(sobelXChan.get(0), sobelXChan.get(0), j11);
            cv.multiply(sobelXChan.get(1), sobelXChan.get(1), tmp);
            cv.add(tmp, j11, j11);
            cv.multiply(sobelXChan.get(2), sobelXChan.get(2), tmp);
            cv.add(tmp, j11, j11);
        });

        const j22 = new cv.Mat();
        defer(() => j22.delete());

        deferred((defer) => {
            const tmp = new cv.Mat();
            defer(() => tmp.delete());

            cv.multiply(sobelYChan.get(0), sobelYChan.get(0), j22);
            cv.multiply(sobelYChan.get(1), sobelYChan.get(1), tmp);
            cv.add(tmp, j22, j22);
            cv.multiply(sobelYChan.get(2), sobelYChan.get(2), tmp);
            cv.add(tmp, j22, j22);
        });

        const j12 = new cv.Mat();
        defer(() => j12.delete());

        deferred((defer) => {
            const tmp = new cv.Mat();
            defer(() => tmp.delete());

            cv.multiply(sobelXChan.get(0), sobelYChan.get(0), j12);
            cv.multiply(sobelXChan.get(1), sobelYChan.get(1), tmp);
            cv.add(tmp, j12, j12);
            cv.multiply(sobelXChan.get(2), sobelYChan.get(2), tmp);
            cv.add(tmp, j12, j12);
        });

        deferred((defer) => {
            const structureTensor = new cv.Mat();
            defer(() => structureTensor.delete());

            const tmp = new cv.MatVector();
            defer(() => tmp.delete());

            tmp.push_back(j11);
            tmp.push_back(j22);
            tmp.push_back(j12);
            cv.merge(tmp, structureTensor);

            postMessage({which: "structureTensor", image: fromCV(structureTensor)});
        });

        let blurKernelSize = Math.ceil(2.5 * blurRadius);
        if (blurKernelSize % 2 == 0) blurKernelSize += 1;
        blurKernelSize = new cv.Size(blurKernelSize, blurKernelSize);

        cv.GaussianBlur(j11, j11, blurKernelSize, blurRadius, blurRadius);
        cv.GaussianBlur(j22, j22, blurKernelSize, blurRadius, blurRadius);
        cv.GaussianBlur(j12, j12, blurKernelSize, blurRadius, blurRadius);


        deferred((defer) => {
            const blurredStructureTensor = new cv.Mat();
            defer(() => blurredStructureTensor.delete());

            const tmp = new cv.MatVector();
            defer(() => tmp.delete());

            tmp.push_back(j11);
            tmp.push_back(j22);
            tmp.push_back(j12);
            cv.merge(tmp, blurredStructureTensor);

            postMessage({which: "blurredStructureTensor", image: fromCV(blurredStructureTensor)});
        });

        const coherency = new cv.Mat();
        defer(() => coherency.delete());
        const orientation = new cv.Mat();
        defer(() => orientation.delete());

        deferred((defer) => {
            const lambda1 = new cv.Mat();
            defer(() => lambda1.delete());
            const lambda2 = new cv.Mat();
            defer(() => lambda2.delete());

            deferred((defer) => {
                const tmp1 = new cv.Mat();
                defer(() => tmp1.delete());

                const tmp2 = new cv.Mat();
                defer(() => tmp2.delete());

                cv.subtract(j11, j22, tmp1);
                cv.multiply(tmp1, tmp1, tmp1);
                cv.multiply(j12, j12, tmp2, 4);
                cv.add(tmp1, tmp2, tmp1);
                cv.sqrt(tmp1, tmp1);
                cv.add(j11, j22, tmp2);
                cv.add(tmp2, tmp1, lambda1);
                cv.subtract(tmp2, tmp1, lambda2);
            });

            deferred((defer) => {
                const tmp1 = new cv.Mat();
                defer(() => tmp1.delete());

                const tmp2 = new cv.Mat();
                defer(() => tmp2.delete());

                cv.subtract(lambda1, lambda2, tmp1);
                cv.add(lambda1, lambda2, tmp2);
                cv.divide(tmp1, tmp2, coherency);

                orientation.create(original.rows, original.cols, cv.CV_32F);
                const data = orientation.data32F;
                for (let i = 0; i < data.length; i++) {
                    data[i] = 0.5 * Math.atan2(2 * j12.data32F[i], j22.data32F[i] - j11.data32F[i]);
                }
            });
        });

        deferred((defer) => {
            const anisotropy = new cv.Mat(original.rows, original.cols, cv.CV_32FC3);
            defer(() => anisotropy.delete());
            const data = anisotropy.data32F;
            for (let i = 0; i < anisotropy.rows * anisotropy.cols; i++) {
                let hue = orientation.data32F[i] * 2 / Math.PI * 180;
                if (hue < 0) hue += 360;

                const c = coherency.data32F[i];
                const x = c * (1 - Math.abs((hue / 60) % 2 - 1));

                if (hue < 60) {
                    data[3*i+0] = c;
                    data[3*i+1] = x;
                    data[3*i+2] = 0;
                } else if (hue < 120) {
                    data[3*i+0] = x;
                    data[3*i+1] = c;
                    data[3*i+2] = 0;
                } else if (hue < 180) {
                    data[3*i+0] = 0;
                    data[3*i+1] = c;
                    data[3*i+2] = x;
                } else if (hue < 240) {
                    data[3*i+0] = 0;
                    data[3*i+1] = x;
                    data[3*i+2] = c;
                } else if (hue < 300) {
                    data[3*i+0] = x;
                    data[3*i+1] = 0;
                    data[3*i+2] = c;
                } else {
                    data[3*i+0] = c;
                    data[3*i+1] = 0;
                    data[3*i+2] = x;
                }
            }

            postMessage({which: "anisotropy", image: fromCV(anisotropy)});
        });

        const radius = Math.ceil(2.5 * kernelRadius);
        const segmentKernel = new cv.Mat(2 * radius + 1, 2 * radius + 1, cv.CV_32F);
        defer(() => segmentKernel.delete());

        const means = new cv.MatVector();
        defer(() => means.delete());
        const stddevs = new cv.MatVector();
        defer(() => stddevs.delete());

        deferred((defer) => {
            for (let s = 0; s < 8; s++) {
                let kernelWeight = 0;

                const low_phi = -Math.PI / 8;
                const high_phi = +Math.PI / 8;
                for (let x = -radius; x <= radius; x++) {
                    for (let y = -radius; y <= radius; y++) {
                        let phi = Math.atan2(y, x);
                        phi += Math.PI / 4 * s;
                        if (phi > Math.PI) phi -= 2 * Math.PI;
                        let w = 0;
                        if (low_phi <= phi && phi <= high_phi) {
                            w = 1 / (2 * Math.PI * kernelRadius * kernelRadius)
                                * Math.exp(-(x * x + y * y) / (2 * kernelRadius * kernelRadius));
                        }
                        segmentKernel.floatPtr(x + radius, y + radius)[0] = w;
                        kernelWeight += w;
                    }
                }

                for (let i = 0; i <= segmentKernel.data32F.length; i++) {
                    segmentKernel.data32F[i] /= kernelWeight;
                }

                const mean = new cv.Mat();
                defer(() => mean.delete());
                cv.filter2D(original, mean, cv.CV_32FC3, segmentKernel);
                means.push_back(mean);

                const stddevRGB = new cv.Mat();
                defer(() => stddevRGB.delete());
                cv.subtract(original, mean, stddevRGB);
                cv.multiply(stddevRGB, stddevRGB, stddevRGB);
                cv.filter2D(stddevRGB, stddevRGB, cv.CV_32FC3, segmentKernel);

                const stddevChan = new cv.MatVector();
                defer(() => stddevChan.delete());
                cv.split(stddevRGB, stddevChan);

                const stddev = new cv.Mat();
                defer(() => stddev.delete());
                stddevChan.get(0).copyTo(stddev);
                cv.add(stddev, stddevChan.get(1), stddev);
                cv.add(stddev, stddevChan.get(2), stddev);

                stddevs.push_back(stddev);
            }
        });

        const filtered = new cv.Mat(original.rows, original.cols, cv.CV_32FC3, new cv.Scalar());
        defer(() => filtered.delete());

        deferred((defer) => {
            const totalWeight = new cv.Mat(original.rows, original.cols, cv.CV_32F, new cv.Scalar());
            defer(() => totalWeight.delete());
            const weight = new cv.Mat();
            defer(() => weight.delete());
            const ones = new cv.Mat(original.rows, original.cols, cv.CV_32F, new cv.Scalar(1));
            defer(() => ones.delete());
            const ks = new cv.Mat(original.rows, original.cols, cv.CV_32F, new cv.Scalar(1000));
            defer(() => ks.delete());
            for (let s = 0; s < 8; s++) {
                cv.multiply(ks, stddevs.get(s), weight)
                cv.pow(weight, 0.5 * sharpness, weight);
                cv.add(ones, weight, weight);
                cv.divide(ones, weight, weight);
                cv.add(totalWeight, weight, totalWeight);
                cv.cvtColor(weight, weight, cv.COLOR_GRAY2RGB);
                cv.multiply(weight, means.get(s), weight);
                cv.add(filtered, weight, filtered);
            }

            cv.cvtColor(totalWeight, totalWeight, cv.COLOR_GRAY2RGB);
            cv.divide(filtered, totalWeight, filtered);
        });

        postMessage({which: "filtered", image: fromCV(filtered)});
    });
};