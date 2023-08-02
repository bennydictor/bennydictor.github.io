let inputEnabled = true;
const inputImage = document.getElementById("inputImage");
const inputScale = document.getElementById("inputScale");
const inputBlurRadius = document.getElementById("inputBlurRadius");
const inputKernelRadius = document.getElementById("inputKernelRadius");
const inputSharpness = document.getElementById("inputSharpness");

const img = new Image();

const imageOriginal = document.getElementById("imageOriginal");
const imageStructureTensor = document.getElementById("imageStructureTensor");
const imageBlurredStructureTensor = document.getElementById("imageBlurredStructureTensor");
const imageAnisotropy = document.getElementById("imageAnisotropy");
const imageFiltered = document.getElementById("imageFiltered");

const worker = new Worker("worker.js");

function updateRender() {
    inputEnabled = false;
    inputImage.disabled = true;
    inputScale.disabled = true;
    inputBlurRadius.disabled = true;
    inputKernelRadius.disabled = true;
    inputSharpness.disabled = true;

    const scale = +inputScale.value / 100;
    const blurRadius = +inputBlurRadius.value / 10 * scale;
    const kernelRadius = +inputKernelRadius.value / 10 * scale;
    const sharpness = +inputSharpness.value;

    deferred((defer) => {
        const original = cv.imread(img);
        defer(() => original.delete());

        cv.cvtColor(original, original, cv.COLOR_RGBA2RGB);
        original.convertTo(original, cv.CV_32FC3, 1.0/255);
        cv.resize(original, original, new cv.Size(), scale, scale, cv.INTER_LINEAR);
        cv.imshow(imageOriginal, original);

        worker.postMessage({inputImage: fromCV(original), blurRadius, kernelRadius, sharpness});
    });
}

worker.addEventListener("message", (e) => {
    const {which, image} = e.data;
    deferred((defer) => {
        const mat = toCV(image);
        defer(() => mat.delete());

        switch (which) {
            case "structureTensor":
                cv.imshow(imageStructureTensor, mat);
                break;
            case "blurredStructureTensor":
                cv.imshow(imageBlurredStructureTensor, mat);
                break;
            case "anisotropy":
                cv.imshow(imageAnisotropy, mat);
                break;
            case "filtered":
                cv.imshow(imageFiltered, mat);
                inputEnabled = true;
                inputImage.disabled = false;
                inputScale.disabled = false;
                inputBlurRadius.disabled = false;
                inputKernelRadius.disabled = false;
                inputSharpness.disabled = false;
                break;
        }
    });
})

img.addEventListener("load", updateRender);
inputScale.addEventListener("change", updateRender);
inputBlurRadius.addEventListener("change", updateRender);
inputKernelRadius.addEventListener("change", updateRender);
inputSharpness.addEventListener("change", updateRender);

function onInputImage() {
    if (inputImage.files.length >= 1) {
        img.src = URL.createObjectURL(inputImage.files[0]);
    }
}
inputImage.addEventListener("change", onInputImage);
onInputImage()

document.addEventListener("paste", (e) => {
    if (!inputEnabled) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') {
            const reader = new FileReader();
            reader.addEventListener("load", (e) => {
                img.src = e.target.result;
            });
            reader.readAsDataURL(item.getAsFile());
            return;
        }
    }
});

