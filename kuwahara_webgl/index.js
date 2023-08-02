const inputImage = document.getElementById("inputImage");
const inputScale = document.getElementById("inputScale");
const inputBlurRadius = document.getElementById("inputBlurRadius");
const inputKernelSkew = document.getElementById("inputKernelSkew");
const inputKernelRadius = document.getElementById("inputKernelRadius");
const inputSharpness = document.getElementById("inputSharpness");
const buttonSaveFiltered = document.getElementById("buttonSaveFiltered");

const imagesContainer = document.querySelector(".images-container");
const imageOriginal = document.getElementById("imageOriginal");
const imageStructureTensor = document.getElementById("imageStructureTensor");
const imageBlurredStructureTensor = document.getElementById("imageBlurredStructureTensor");
const imageAnisotropy = document.getElementById("imageAnisotropy");
const imageFiltered = document.getElementById("imageFiltered");

const img = new Image();
const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");
gl.getExtension("EXT_color_buffer_float");


async function createShader(type, url) {
    const resp = await fetch(url);
    const source = await resp.text();

    console.groupCollapsed(`shader source ${url}`);
    console.log(source);
    console.groupEnd();

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        const infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw infoLog;
    }

    return shader;
}

function createProgram(vertexShader, fragmentShader, uniforms, attributes) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        const infoLog = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw infoLog;
    }

    const uniformLocs = {};
    for (let v of uniforms) {
        uniformLocs[v] = gl.getUniformLocation(program, v);
    }

    const attributeLocs = {};
    for (let v of attributes) {
        attributeLocs[v] = gl.getAttribLocation(program, v);
    }

    return {p: program, u: uniformLocs, a: attributeLocs};
}

async function createFragProgram(fragmentShaderUrl, ...uniforms) {
    const fragmentShader = await createShader(gl.FRAGMENT_SHADER, fragmentShaderUrl);
    return createProgram(vertexShader, fragmentShader, uniforms, ["vertexPos"]);
}

function createTexture() {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

let positionBuffer;
let frameBuffer;

let textureOriginal;
let textureStructureTensor;
let textureHBlurredStructureTensor;
let textureBlurredStructureTensor;
let textureAnisotropy;
let textureFiltered;

let vertexShader;
let programCopy;
let programStructureTensor;
let programHBlurredStructureTensor;
let programBlurredStructureTensor;
let programAnisotropy;
let programShowAnisotropy;
let programKuwahara;

async function init() {
    const vertexPositions = [
        -1, -1,
        -1, +1,
        +1, +1,
        +1, -1,
    ];
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);

    frameBuffer = gl.createFramebuffer();

    textureOriginal = createTexture();
    textureStructureTensor = createTexture();
    textureHBlurredStructureTensor = createTexture();
    textureBlurredStructureTensor = createTexture();
    textureAnisotropy = createTexture();
    textureFiltered = createTexture();

    vertexShader = await createShader(gl.VERTEX_SHADER, "vertex.glsl");

    programCopy = await createFragProgram(
        "copy.glsl",
        "flipY", "tex",
    );
    programStructureTensor = await createFragProgram(
        "structureTensor.glsl",
        "flipY", "res", "original",
    );
    programHBlurredStructureTensor = await createFragProgram(
        "hBlurredStructureTensor.glsl",
        "flipY", "res", "blurRadius", "structureTensor",
    );
    programBlurredStructureTensor = await createFragProgram(
        "blurredStructureTensor.glsl",
        "flipY", "res", "blurRadius", "hBlurredStructureTensor",
    );
    programAnisotropy = await createFragProgram(
        "anisotropy.glsl",
        "flipY", "blurredStructureTensor",
    );
    programShowAnisotropy = await createFragProgram(
        "showAnisotropy.glsl",
        "flipY", "anisotropy",
    );
    programKuwahara = await createFragProgram(
        "kuwahara.glsl",
        "flipY", "res", "original", "anisotropy", "kernelRadius", "kernelSkew", "sharpness",
    );

    gl.clearColor(0, 0, 0, 0);

    img.addEventListener("load", loadImg);
    inputScale.addEventListener("input", loadImg);

    inputBlurRadius.addEventListener("input", recompute);
    inputKernelRadius.addEventListener("input", recompute);
    inputKernelSkew.addEventListener("input", recompute);
    inputSharpness.addEventListener("input", recompute);
    buttonSaveFiltered.addEventListener("click", saveFiltered);

    imagesContainer.addEventListener("scroll", render);
    window.addEventListener("scroll", render);
    window.addEventListener("resize", render);

    function onInputImage() {
        if (inputImage.files.length >= 1) {
            img.src = URL.createObjectURL(inputImage.files[0]);
        }
    }
    inputImage.addEventListener("change", onInputImage);
    onInputImage()

    document.addEventListener("paste", (e) => {
        for (let item of e.clipboardData.items) {
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
}


function resizeImage(image, width, height) {
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
}

let width, height;

function loadImg() {
    const scale = +inputScale.value / 100;

    width = Math.ceil(img.width * scale);
    height = Math.ceil(img.height * scale);

    resizeImage(imageOriginal, width, height);
    resizeImage(imageStructureTensor, width, height);
    resizeImage(imageBlurredStructureTensor, width, height);
    resizeImage(imageAnisotropy, width, height);
    resizeImage(imageFiltered, width, height);

    gl.bindTexture(gl.TEXTURE_2D, textureOriginal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.bindTexture(gl.TEXTURE_2D, textureStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureHBlurredStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureBlurredStructureTensor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureAnisotropy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, textureFiltered);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    recompute();
}

function scissorImage(image) {
    const rect = image.getBoundingClientRect();
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const left = rect.left;
    const bottom = gl.canvas.clientHeight - rect.bottom;

    gl.viewport(left, bottom, width, height);
    gl.scissor(left, bottom, width, height);
}

function runFragProgram(image, program, uniforms) {
    if (image instanceof WebGLTexture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, image, 0);
        gl.disable(gl.SCISSOR_TEST);
        gl.viewport(0, 0, width, height);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.SCISSOR_TEST);
        scissorImage(image);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program.p);
    gl.enableVertexAttribArray(program.a.vertexPos);
    gl.vertexAttribPointer(program.a.vertexPos, 2, gl.FLOAT, false, 0, 0);
    let texI = 0;
    for (let name in uniforms) {
        if (uniforms[name] instanceof WebGLTexture) {
            gl.uniform1i(program.u[name], texI);
            gl.activeTexture(gl.TEXTURE0+texI);
            gl.bindTexture(gl.TEXTURE_2D, uniforms[name]);
            texI++;
        } else if (typeof uniforms[name] === "number") {
            gl.uniform1f(program.u[name], uniforms[name]);
        } else if (uniforms[name].length === 2) {
            gl.uniform2f(program.u[name], uniforms[name][0], uniforms[name][1]);
        } else {
            throw new TypeError("bad uniform type");
        }
    }
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}

function recompute() {
    if (img.src === "") return;

    const scale = +inputScale.value / 100;
    const width = Math.ceil(img.width * scale);
    const height = Math.ceil(img.height * scale);
    const blurRadius = +inputBlurRadius.value / 10 * scale;
    const kernelRadius = +inputKernelRadius.value / 10 * scale;
    const kernelSkew = +inputKernelSkew.value / 10;
    const sharpness = +inputSharpness.value;

    runFragProgram(textureStructureTensor, programStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        original: textureOriginal,
    });
    runFragProgram(textureHBlurredStructureTensor, programHBlurredStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        blurRadius,
        structureTensor: textureStructureTensor,
    });
    runFragProgram(textureBlurredStructureTensor, programBlurredStructureTensor, {
        flipY: 0.0,
        res: [width, height],
        blurRadius,
        hBlurredStructureTensor: textureHBlurredStructureTensor,
    });
    runFragProgram(textureAnisotropy, programAnisotropy, {
        flipY: 0.0,
        blurredStructureTensor: textureBlurredStructureTensor,
    });
    runFragProgram(textureFiltered, programKuwahara, {
        flipY: 0.0,
        res: [width, height],
        original: textureOriginal,
        anisotropy: textureAnisotropy,
        kernelRadius,
        kernelSkew,
        sharpness,
    });

    render();
}

async function saveFiltered() {
    if (img.src === "") return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureFiltered, 0);

    const filteredImg = new OffscreenCanvas(width, height);
    const ctx = filteredImg.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
    ctx.putImageData(imageData, 0, 0);
    const blob = await filteredImg.convertToBlob({type: "png"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let downloadName = "filtered.png";
    if (inputImage.files.length > 0) {
        downloadName = inputImage.files[0].name.replace(/\.[a-z0-9]+$/i, "") + " filtered.png";
    }
    link.download = downloadName;
    link.click();
}

function render() {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    canvas.style.transform = `translateX(${window.scrollX}px) translateY(${window.scrollY}px)`;

    runFragProgram(imageOriginal, programCopy, {
        flipY: 1.0,
        tex: textureOriginal,
    });
    runFragProgram(imageStructureTensor, programCopy, {
        flipY: 1.0,
        tex: textureStructureTensor,
    });
    runFragProgram(imageBlurredStructureTensor, programCopy, {
        flipY: 1.0,
        tex: textureBlurredStructureTensor,
    });
    runFragProgram(imageAnisotropy, programShowAnisotropy, {
        flipY: 1.0,
        tex: textureAnisotropy,
    });
    runFragProgram(imageFiltered, programCopy, {
        flipY: 1.0,
        tex: textureFiltered,
    });

    gl.flush();
}

init();